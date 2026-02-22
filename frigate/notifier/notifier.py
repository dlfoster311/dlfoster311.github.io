"""
Frigate → ntfy notification bridge.

Subscribes to Frigate's MQTT event stream and sends push notifications
to ntfy when the AI detects objects matching your alert rules.

All settings come from environment variables (set in docker-compose.yml).
"""

import json
import os
import time

import paho.mqtt.client as mqtt
import requests

# ── Settings from environment ─────────────────────────────────────────────────

MQTT_HOST    = os.getenv("MQTT_HOST",    "mosquitto")
MQTT_PORT    = int(os.getenv("MQTT_PORT", "1883"))

NTFY_URL     = os.getenv("NTFY_URL",   "https://ntfy.sh").rstrip("/")
NTFY_TOPIC   = os.getenv("NTFY_TOPIC", "frigate-alerts")

FRIGATE_URL  = os.getenv("FRIGATE_URL", "http://frigate:5000").rstrip("/")

ALERT_OBJECTS = set(os.getenv("ALERT_OBJECTS", "person,car").split(","))
MIN_SCORE     = float(os.getenv("MIN_SCORE", "0.75"))
REQUIRE_ZONE  = os.getenv("REQUIRE_ZONE", "true").lower() == "true"
COOLDOWN      = int(os.getenv("ALERT_COOLDOWN", "120"))

# Per-object notification priority for ntfy
PRIORITY = {
    "person": "high",
    "car":    "default",
    "cat":    "low",
    "dog":    "low",
    "bird":   "min",
}

# Per-object emoji tags for ntfy
TAGS = {
    "person": "bust_in_silhouette,rotating_light",
    "car":    "car",
    "cat":    "cat",
    "dog":    "dog",
    "bird":   "bird",
}

# ── Cooldown tracking ─────────────────────────────────────────────────────────

_last_alerted: dict[str, float] = {}


def _cooldown_key(camera: str, label: str) -> str:
    return f"{camera}:{label}"


def _in_cooldown(camera: str, label: str) -> bool:
    key = _cooldown_key(camera, label)
    return time.monotonic() - _last_alerted.get(key, 0) < COOLDOWN


def _mark_alerted(camera: str, label: str) -> None:
    _last_alerted[_cooldown_key(camera, label)] = time.monotonic()


# ── Alert logic ───────────────────────────────────────────────────────────────

def should_alert(event: dict) -> tuple[bool, str]:
    """Return (True, '') if this event should fire a notification, else (False, reason)."""
    label  = event.get("label", "")
    camera = event.get("camera", "")
    score  = event.get("score") or event.get("top_score") or 0
    zones  = event.get("current_zones") or []

    if label not in ALERT_OBJECTS:
        return False, f"label '{label}' not in ALERT_OBJECTS"

    if score < MIN_SCORE:
        return False, f"score {score:.0%} < MIN_SCORE {MIN_SCORE:.0%}"

    if REQUIRE_ZONE and not zones:
        return False, "object not in any zone (REQUIRE_ZONE=true)"

    if _in_cooldown(camera, label):
        return False, f"cooldown active ({COOLDOWN}s)"

    return True, ""


def send_notification(event: dict) -> None:
    label    = event.get("label", "object")
    camera   = event.get("camera", "unknown")
    score    = event.get("score") or event.get("top_score") or 0
    zones    = event.get("current_zones") or []
    event_id = event.get("id", "")

    camera_name = camera.replace("_", " ").title()
    label_name  = label.title()
    zone_str    = (
        " in " + ", ".join(z.replace("_", " ").title() for z in zones)
        if zones else ""
    )

    title = f"{label_name} detected \u2014 {camera_name}"
    body  = f"{label_name}{zone_str} ({score:.0%} confidence)"

    headers: dict[str, str] = {
        "Title":    title,
        "Priority": PRIORITY.get(label, "default"),
        "Tags":     TAGS.get(label, "bell"),
        "Click":    f"{FRIGATE_URL}/events?camera={camera}",
    }

    # Attach the snapshot image.
    # Note: ntfy.sh will try to fetch this URL from the internet.
    # If Frigate is on your local network only, the image won't attach
    # on ntfy.sh cloud — but it will work if you self-host ntfy on the
    # same network. The notification will still arrive either way.
    if event_id:
        headers["Attach"] = f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg"

    try:
        resp = requests.post(
            f"{NTFY_URL}/{NTFY_TOPIC}",
            data=body.encode("utf-8"),
            headers=headers,
            timeout=10,
        )
        if resp.ok:
            print(f"[notify] Sent: {title}")
        else:
            print(f"[notify] ntfy error {resp.status_code}: {resp.text[:200]}")
    except requests.RequestException as exc:
        print(f"[notify] Failed to reach ntfy: {exc}")


# ── MQTT callbacks ────────────────────────────────────────────────────────────

def on_connect(client: mqtt.Client, userdata, flags, rc: int) -> None:
    if rc == 0:
        client.subscribe("frigate/events")
        print(f"[mqtt] Connected to {MQTT_HOST}:{MQTT_PORT}, subscribed to frigate/events")
    else:
        print(f"[mqtt] Connection failed (rc={rc})")


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload)
    except json.JSONDecodeError:
        return

    # Frigate publishes event updates as type "new", "update", or "end".
    # We only alert on "new" so you get one notification per detection event,
    # not one per frame.
    if payload.get("type") != "new":
        return

    event = payload.get("after") or {}
    ok, reason = should_alert(event)

    label  = event.get("label", "?")
    camera = event.get("camera", "?")

    if ok:
        _mark_alerted(camera, label)
        send_notification(event)
    else:
        print(f"[skip] {camera}/{label}: {reason}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("[config] Alert objects:", sorted(ALERT_OBJECTS))
    print(f"[config] Min score:    {MIN_SCORE:.0%}")
    print(f"[config] Require zone: {REQUIRE_ZONE}")
    print(f"[config] Cooldown:     {COOLDOWN}s")
    print(f"[config] ntfy topic:   {NTFY_URL}/{NTFY_TOPIC}")

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as exc:
            print(f"[mqtt] Error: {exc} — retrying in 10s")
            time.sleep(10)


if __name__ == "__main__":
    main()
