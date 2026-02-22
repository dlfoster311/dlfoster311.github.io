"""
Frigate + Double-Take → ntfy push notification bridge.

Event routing:
  frigate/events            → non-person objects (car, package, cat, etc.)
  frigate/+/audio/+         → audio detection (glass breaking, alarms, screaming, etc.)
  double-take/cameras/#     → face-identified person events
                               - known family member → low-priority "arrived home"
                               - unrecognized face   → urgent "Stranger" alert

All settings are environment variables configured in docker-compose.yml.
"""

import datetime
import json
import os
import time

import paho.mqtt.client as mqtt
import requests

# ── Settings ──────────────────────────────────────────────────────────────────

MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

NTFY_URL   = os.getenv("NTFY_URL",   "https://ntfy.sh").rstrip("/")
NTFY_TOPIC = os.getenv("NTFY_TOPIC", "frigate-alerts")

# External URL for links in notifications. After setting up Tailscale, change
# this to http://YOUR_TAILSCALE_IP:5000 so links open from anywhere on your phone.
FRIGATE_URL = os.getenv("FRIGATE_URL", "http://frigate:5000").rstrip("/")

# Objects that trigger Frigate-level alerts.
# "person" is intentionally excluded here — persons go through Double-Take
# for face recognition. If USE_FACE_RECOGNITION=false, person alerts still fire.
ALERT_OBJECTS = set(os.getenv("ALERT_OBJECTS", "car,package").split(","))
MIN_SCORE     = float(os.getenv("MIN_SCORE", "0.75"))
REQUIRE_ZONE  = os.getenv("REQUIRE_ZONE", "true").lower() == "true"
COOLDOWN      = int(os.getenv("ALERT_COOLDOWN", "120"))

# Face recognition settings
USE_FACE_RECOGNITION = os.getenv("USE_FACE_RECOGNITION", "true").lower() == "true"
MIN_FACE_SCORE       = float(os.getenv("MIN_FACE_SCORE", "0.80"))

# Names (lowercase) that are family — get a quiet "arrived home" instead of alert.
# Fill in after training Double-Take. Example: "david,sarah"
_known_str   = os.getenv("KNOWN_PEOPLE", "")
KNOWN_PEOPLE = {n.strip().lower() for n in _known_str.split(",") if n.strip()}

# Set to "false" to suppress family arrival notifications entirely.
FAMILY_ARRIVAL_ALERTS = os.getenv("FAMILY_ARRIVAL_ALERTS", "true").lower() == "true"

# ── Quiet hours ───────────────────────────────────────────────────────────────
# During quiet hours only urgent alerts fire (strangers + audio alarms).
# Car detections, packages, family arrivals, and barking are suppressed.
# Default: quiet from 10pm to 7am. Set to the same value to disable entirely.
QUIET_START = int(os.getenv("QUIET_HOURS_START", "22"))   # 22 = 10pm
QUIET_END   = int(os.getenv("QUIET_HOURS_END",   "7"))    #  7 = 7am

# These event types always wake you regardless of quiet hours
_ALWAYS_ALERT = {
    "stranger", "glass_breaking", "screaming",
    "fire_alarm", "smoke_detector_alarm",
}


def _in_quiet_hours() -> bool:
    h = datetime.datetime.now().hour
    if QUIET_START == QUIET_END:
        return False            # same value = quiet hours disabled
    if QUIET_START > QUIET_END:   # wraps midnight (22:00 → 07:00)
        return h >= QUIET_START or h < QUIET_END
    return QUIET_START <= h < QUIET_END

# ── ntfy priority and tag mappings ────────────────────────────────────────────

PRIORITY = {
    "stranger":            "urgent",
    "person":              "high",
    "package":             "high",
    "car":                 "default",
    "family":              "low",
    "dog":                 "low",
    "cat":                 "low",
    "bird":                "min",
    # Audio events
    "glass_breaking":      "urgent",
    "screaming":           "urgent",
    "fire_alarm":          "urgent",
    "smoke_detector_alarm": "urgent",
    "bark":                "default",
    "speech":              "low",
    "motorcycle":          "low",
}

TAGS = {
    "stranger":            "warning,bust_in_silhouette",
    "person":              "bust_in_silhouette,rotating_light",
    "package":             "package",
    "car":                 "car",
    "family":              "house",
    "dog":                 "dog",
    "cat":                 "cat",
    "bird":                "bird",
    # Audio events
    "glass_breaking":      "rotating_light,glass",
    "screaming":           "rotating_light,sos",
    "fire_alarm":          "fire,rotating_light",
    "smoke_detector_alarm": "fire,rotating_light",
    "bark":                "dog",
    "speech":              "speech_balloon",
    "motorcycle":          "oncoming_automobile",
}

# Human-readable alert titles and body text for each audio event
_AUDIO_ALERTS: dict[str, tuple[str, str]] = {
    "glass_breaking":      ("Glass breaking — {camera}", "Sound of breaking glass detected"),
    "screaming":           ("Screaming detected — {camera}", "Human screaming detected — check camera"),
    "fire_alarm":          ("Fire alarm — {camera}", "Fire or smoke alarm sound detected"),
    "smoke_detector_alarm": ("Smoke alarm — {camera}", "Smoke or CO detector going off"),
    "bark":                ("Dog barking — {camera}", "Barking detected"),
    "speech":              ("Speech — {camera}", "Human speech detected"),
    "motorcycle":          ("Loud engine — {camera}", "Motorcycle or loud engine detected"),
}

# ── Cooldown tracking ─────────────────────────────────────────────────────────

_last_alerted: dict[str, float] = {}


def _in_cooldown(key: str) -> bool:
    return time.monotonic() - _last_alerted.get(key, 0) < COOLDOWN


def _mark_alerted(key: str) -> None:
    _last_alerted[key] = time.monotonic()


# ── ntfy sender ───────────────────────────────────────────────────────────────

def _send(
    title: str,
    body: str,
    kind: str,
    camera: str,
    event_id: str = "",
) -> None:
    """POST a notification to ntfy."""
    headers: dict[str, str] = {
        "Title":    title,
        "Priority": PRIORITY.get(kind, "default"),
        "Tags":     TAGS.get(kind, "bell"),
        "Click":    f"{FRIGATE_URL}/events?camera={camera}",
    }
    # Attach camera snapshot. Works reliably when ntfy is self-hosted on the
    # same Docker network as Frigate (ntfy fetches the image server-side).
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
            print(f"[notify] {title}")
        else:
            print(f"[notify] ntfy {resp.status_code}: {resp.text[:120]}")
    except requests.RequestException as exc:
        print(f"[notify] Failed to reach ntfy: {exc}")


# ── Frigate object event handler ──────────────────────────────────────────────

def handle_frigate_event(payload: dict) -> None:
    if payload.get("type") != "new":
        return

    event    = payload.get("after") or {}
    label    = event.get("label", "")
    camera   = event.get("camera", "")
    score    = event.get("score") or event.get("top_score") or 0
    zones    = event.get("current_zones") or []
    event_id = event.get("id", "")

    # Persons are routed through Double-Take when face recognition is on
    if USE_FACE_RECOGNITION and label == "person":
        return

    if label not in ALERT_OBJECTS:
        print(f"[skip] {camera}/{label}: not in ALERT_OBJECTS")
        return
    if score < MIN_SCORE:
        print(f"[skip] {camera}/{label}: score {score:.0%} < {MIN_SCORE:.0%}")
        return
    if REQUIRE_ZONE and not zones:
        print(f"[skip] {camera}/{label}: not in any zone")
        return
    if _in_quiet_hours() and label not in _ALWAYS_ALERT:
        print(f"[skip] {camera}/{label}: quiet hours ({QUIET_START:02d}:00–{QUIET_END:02d}:00)")
        return

    key = f"{camera}:{label}"
    if _in_cooldown(key):
        print(f"[skip] {camera}/{label}: cooldown")
        return

    _mark_alerted(key)

    camera_name = camera.replace("_", " ").title()
    label_name  = label.title()
    zone_str    = (
        " in " + ", ".join(z.replace("_", " ").title() for z in zones)
        if zones else ""
    )

    if label == "package":
        title = f"Package delivered — {camera_name}"
        body  = f"Package spotted{zone_str}"
    elif label == "car":
        title = f"Vehicle at {camera_name}"
        body  = f"Vehicle detected{zone_str} ({score:.0%} confidence)"
    else:
        title = f"{label_name} detected — {camera_name}"
        body  = f"{label_name}{zone_str} ({score:.0%} confidence)"

    _send(title, body, label, camera, event_id)


# ── Double-Take face recognition event handler ────────────────────────────────

def handle_face_event(topic: str, payload: dict) -> None:
    # Topic: double-take/cameras/{camera}/{name}
    parts = topic.split("/")
    if len(parts) < 4:
        return

    camera     = parts[2]
    name       = parts[3].lower()
    confidence = payload.get("confidence", 0)
    event_id   = (payload.get("event") or {}).get("id", "")
    zones      = (payload.get("event") or {}).get("current_zones") or []

    camera_name = camera.replace("_", " ").title()
    zone_str    = (
        " in " + ", ".join(z.replace("_", " ").title() for z in zones)
        if zones else ""
    )

    if confidence < MIN_FACE_SCORE:
        print(f"[skip] face/{camera}/{name}: {confidence:.0%} < {MIN_FACE_SCORE:.0%}")
        return

    if REQUIRE_ZONE and not zones:
        print(f"[skip] face/{camera}/{name}: not in any zone")
        return

    if name in KNOWN_PEOPLE:
        # ── Family member ────────────────────────────────────────────────────
        key = f"{camera}:family:{name}"
        if _in_cooldown(key):
            print(f"[skip] face/{camera}/{name}: cooldown")
            return
        _mark_alerted(key)

        if not FAMILY_ARRIVAL_ALERTS:
            print(f"[known] {name} at {camera} — arrival alerts disabled")
            return
        if _in_quiet_hours():
            print(f"[skip] face/{camera}/{name}: quiet hours — family arrival suppressed")
            return

        name_display = name.title()
        title = f"{name_display} is home — {camera_name}"
        body  = f"{name_display} arrived{zone_str} ({confidence:.0%})"
        print(f"[known] {title}")
        _send(title, body, "family", camera, event_id)

    else:
        # ── Unknown / stranger ───────────────────────────────────────────────
        key = f"{camera}:stranger"
        if _in_cooldown(key):
            print(f"[skip] face/{camera}/stranger: cooldown")
            return
        _mark_alerted(key)

        title = f"Stranger at {camera_name}"
        body  = f"Unrecognized person detected{zone_str} — check camera"
        print(f"[alert] {title}")
        _send(title, body, "stranger", camera, event_id)


# ── Audio event handler ───────────────────────────────────────────────────────

def handle_audio_event(topic: str, payload: dict) -> None:
    # Topic: frigate/{camera}/audio/{event_type}
    parts = topic.split("/")
    if len(parts) < 4:
        return

    camera     = parts[1]
    event_type = parts[3]

    if event_type not in _AUDIO_ALERTS:
        print(f"[skip] audio/{camera}/{event_type}: not in alert list")
        return

    key = f"{camera}:audio:{event_type}"
    if _in_cooldown(key):
        print(f"[skip] audio/{camera}/{event_type}: cooldown")
        return
    _mark_alerted(key)

    camera_name = camera.replace("_", " ").title()
    title_tpl, body = _AUDIO_ALERTS[event_type]
    title = title_tpl.format(camera=camera_name)

    print(f"[audio] {title}")
    # Audio events don't have a snapshot, but we link to the camera's event page
    _send(title, body, event_type, camera, event_id="")


# ── MQTT ──────────────────────────────────────────────────────────────────────

def on_connect(client: mqtt.Client, userdata, flags, rc: int) -> None:
    if rc != 0:
        print(f"[mqtt] Connection failed (rc={rc})")
        return

    client.subscribe("frigate/events")
    client.subscribe("frigate/+/audio/+")
    print(f"[mqtt] Connected to {MQTT_HOST}:{MQTT_PORT}")
    print("[mqtt] Subscribed to: frigate/events, frigate/+/audio/+")

    if USE_FACE_RECOGNITION:
        client.subscribe("double-take/cameras/#")
        print("[mqtt] Subscribed to: double-take/cameras/#")


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    try:
        payload = json.loads(msg.payload)
    except json.JSONDecodeError:
        return

    topic = msg.topic
    if topic == "frigate/events":
        handle_frigate_event(payload)
    elif "/audio/" in topic:
        handle_audio_event(topic, payload)
    elif topic.startswith("double-take/cameras/"):
        handle_face_event(topic, payload)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("[config] Face recognition:    ", USE_FACE_RECOGNITION)
    if USE_FACE_RECOGNITION:
        print("[config] Known family members:", sorted(KNOWN_PEOPLE) or "(none — add after training)")
        print(f"[config] Min face confidence:  {MIN_FACE_SCORE:.0%}")
        print(f"[config] Family arrival alerts: {FAMILY_ARRIVAL_ALERTS}")
    print("[config] Object alerts:       ", sorted(ALERT_OBJECTS))
    print(f"[config] Min object score:     {MIN_SCORE:.0%}")
    print(f"[config] Require zone:         {REQUIRE_ZONE}")
    print("[config] Audio alerts:        ", sorted(_AUDIO_ALERTS.keys()))
    if QUIET_START != QUIET_END:
        print(f"[config] Quiet hours:          {QUIET_START:02d}:00–{QUIET_END:02d}:00 (urgent alerts still fire)")
    else:
        print("[config] Quiet hours:          disabled")
    print(f"[config] Cooldown:             {COOLDOWN}s")
    print(f"[config] ntfy endpoint:        {NTFY_URL}/{NTFY_TOPIC}")
    print("=" * 60)

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
