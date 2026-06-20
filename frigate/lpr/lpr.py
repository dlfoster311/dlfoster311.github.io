"""
License plate recognition service.

Listens to Frigate's MQTT events.  When a car (or other vehicle) event
ends, it downloads the snapshot and sends it to the Plate Recognizer API.
If a plate is found, it fires an ntfy notification and appends to a log.

Free tier:  2,500 reads/month — https://platerecognizer.com/sign-up/
No API key: the service starts but skips all LPR calls (just logs a warning).

Environment variables
─────────────────────
PLATE_RECOGNIZER_TOKEN  (required) — API token from platerecognizer.com
MQTT_HOST               MQTT broker host         (default: mosquitto)
MQTT_PORT               MQTT broker port         (default: 1883)
NTFY_URL                ntfy server URL          (default: http://ntfy:80)
NTFY_TOPIC              ntfy topic               (default: frigate-alerts)
FRIGATE_URL             Frigate URL for clips    (default: http://frigate:5000)
LPR_OBJECTS             Comma-sep labels to scan (default: car)
MIN_PLATE_CONFIDENCE    Minimum score 0-1        (default: 0.80)
PLATE_COOLDOWN          Seconds before re-alerting same plate (default: 3600)
LPR_REGION              Plate region hint, e.g. us-ca, ca-on (default: empty)
LOG_FILE                Path to append plate log  (default: /data/plates.log)
"""

import json
import logging
import os
import time
from datetime import datetime

import paho.mqtt.client as mqtt
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [lpr] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("lpr")

# ── Settings ──────────────────────────────────────────────────────────────────

TOKEN       = os.getenv("PLATE_RECOGNIZER_TOKEN", "")
MQTT_HOST   = os.getenv("MQTT_HOST",  "mosquitto")
MQTT_PORT   = int(os.getenv("MQTT_PORT", "1883"))
NTFY_URL    = os.getenv("NTFY_URL",   "http://ntfy:80").rstrip("/")
NTFY_TOPIC  = os.getenv("NTFY_TOPIC", "frigate-alerts")
FRIGATE_URL = os.getenv("FRIGATE_URL","http://frigate:5000").rstrip("/")

LPR_OBJECTS  = set(os.getenv("LPR_OBJECTS", "car").split(","))
MIN_CONF     = float(os.getenv("MIN_PLATE_CONFIDENCE", "0.80"))
COOLDOWN     = int(os.getenv("PLATE_COOLDOWN", "3600"))   # 1 hour default
LPR_REGION   = os.getenv("LPR_REGION", "")               # e.g. "us-ca"
LOG_FILE     = os.getenv("LOG_FILE", "/data/plates.log")

# In-memory cooldown:  plate_text → last_alerted unix timestamp
_alerted: dict[str, float] = {}

PLATE_RECOGNIZER_URL = "https://api.platerecognizer.com/v1/plate-reader/"

# ── Plate Recognizer API ──────────────────────────────────────────────────────

def read_plate(image_bytes: bytes) -> dict | None:
    """
    Send snapshot to Plate Recognizer.
    Returns the best result dict or None if nothing found / API unavailable.
    """
    if not TOKEN:
        log.warning("PLATE_RECOGNIZER_TOKEN not set — skipping LPR")
        return None

    try:
        payload: dict = {}
        if LPR_REGION:
            payload["regions"] = LPR_REGION

        resp = requests.post(
            PLATE_RECOGNIZER_URL,
            files={"upload": ("snap.jpg", image_bytes, "image/jpeg")},
            data=payload,
            headers={"Authorization": f"Token {TOKEN}"},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        log.error("Plate Recognizer API error: %s", exc)
        return None

    results = data.get("results", [])
    if not results:
        return None

    # Return the highest-confidence result
    return max(results, key=lambda r: r.get("plate", {}).get("confidence", 0))


# ── ntfy helper ───────────────────────────────────────────────────────────────

def send_alert(plate: str, camera: str, details: str, image: bytes) -> None:
    """Fire an ntfy notification with the plate number and snapshot attached."""
    try:
        resp = requests.put(
            f"{NTFY_URL}/{NTFY_TOPIC}",
            data=image,
            headers={
                "Title":    f"License plate — {camera}",
                "Message":  f"{plate}  ·  {details}",
                "Priority": "default",
                "Tags":     "car,blue_car",
                "Filename": f"plate-{plate}.jpg",
                "Click":    f"{FRIGATE_URL}/events",
            },
            timeout=20,
        )
        log.info("ntfy %s: %s — %s", "OK" if resp.ok else resp.status_code, plate, details)
    except Exception as exc:
        log.error("ntfy send failed: %s", exc)


# ── Plate log ─────────────────────────────────────────────────────────────────

def log_plate(plate: str, camera: str, details: str) -> None:
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"{ts}\t{camera}\t{plate}\t{details}\n")
    except Exception as exc:
        log.error("Log write failed: %s", exc)


# ── Frigate snapshot ──────────────────────────────────────────────────────────

def fetch_snapshot(event_id: str) -> bytes | None:
    try:
        resp = requests.get(
            f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg",
            params={"bbox": 0, "crop": 0},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.content
    except Exception as exc:
        log.warning("Snapshot fetch failed (%s): %s", event_id, exc)
        return None


# ── Event processing ──────────────────────────────────────────────────────────

def handle_event(payload: dict) -> None:
    """Process one Frigate event payload."""
    ev_type = payload.get("type")
    after   = payload.get("after") or {}
    label   = after.get("label", "")
    camera  = after.get("camera", "unknown")

    # Only act on events that just ended (camera has final snapshot)
    if ev_type != "end":
        return
    if label not in LPR_OBJECTS:
        return

    event_id = after.get("id") or payload.get("before", {}).get("id", "")
    if not event_id:
        return

    log.info("Car event ended — %s/%s (id=%s), running LPR ...", camera, label, event_id)

    snapshot = fetch_snapshot(event_id)
    if not snapshot:
        return

    result = read_plate(snapshot)
    if not result:
        log.info("No plate found in %s/%s", camera, label)
        return

    plate_info  = result.get("plate", {})
    plate_text  = plate_info.get("value", "").upper().replace(" ", "")
    confidence  = plate_info.get("confidence", 0)

    if confidence < MIN_CONF:
        log.info("Plate %s confidence %.0f%% < %.0f%% threshold — skipped",
                 plate_text, confidence * 100, MIN_CONF * 100)
        return

    # Build a readable details string
    vehicle     = result.get("vehicle", {})
    v_type      = vehicle.get("type", "")
    colors      = vehicle.get("color", [])
    color_name  = colors[0]["value"].title() if colors else ""
    region_code = (result.get("region") or {}).get("code", "")

    parts = [p for p in [color_name, v_type.title(), region_code] if p]
    details = " · ".join(parts) if parts else "unknown vehicle"

    # Cooldown per plate
    now = time.time()
    last = _alerted.get(plate_text, 0)
    if now - last < COOLDOWN:
        remaining = int(COOLDOWN - (now - last)) // 60
        log.info("Plate %s in cooldown (%d min remaining)", plate_text, remaining)
        return

    _alerted[plate_text] = now
    log.info("PLATE: %s — %s at %s (%.0f%% confidence)", plate_text, details, camera, confidence * 100)

    log_plate(plate_text, camera, details)
    send_alert(plate_text, camera, details, snapshot)


# ── MQTT client ───────────────────────────────────────────────────────────────

def on_connect(client, _userdata, _flags, rc):
    if rc == 0:
        log.info("Connected to MQTT broker %s:%s", MQTT_HOST, MQTT_PORT)
        client.subscribe("frigate/events")
    else:
        log.error("MQTT connect failed: rc=%d", rc)


def on_message(_client, _userdata, msg):
    try:
        payload = json.loads(msg.payload)
        handle_event(payload)
    except Exception as exc:
        log.error("Message handling error: %s", exc)


def main() -> None:
    log.info("LPR service starting")
    log.info("Objects: %s | Min confidence: %.0f%% | Cooldown: %ds",
             LPR_OBJECTS, MIN_CONF * 100, COOLDOWN)
    if not TOKEN:
        log.warning("No PLATE_RECOGNIZER_TOKEN — set it in .env to enable LPR")
    if LPR_REGION:
        log.info("Region hint: %s", LPR_REGION)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception as exc:
            log.error("MQTT error: %s — retrying in 10s", exc)
            time.sleep(10)


if __name__ == "__main__":
    main()
