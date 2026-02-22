"""
Wildlife species identification service.

When Frigate detects a bird, deer, squirrel, raccoon, or other animal,
this service downloads the snapshot and sends it to the iNaturalist
computer vision API to identify the exact species.

Examples of notifications you'll receive:
  "Northern Cardinal at Backyard"
  "Eastern Gray Squirrel at Driveway"
  "White-tailed Deer at Backyard"
  "Red-tailed Hawk at Front Door"

The iNaturalist model is trained on tens of millions of wildlife photos
and covers birds, mammals, reptiles, insects, amphibians — everything.

Setup (free):
  1. Create a free account at https://www.inaturalist.org
  2. Get your API token at https://www.inaturalist.org/users/api_token
  3. Add INAT_TOKEN=your_token to .env

Optional accuracy boost:
  Set INAT_LAT and INAT_LNG to your rough location (e.g. 37.77, -122.41)
  The model uses local species ranges to narrow down candidates.

Environment variables
─────────────────────
INAT_TOKEN           iNaturalist API token (required)
INAT_LAT             Latitude  (optional, improves accuracy)
INAT_LNG             Longitude (optional, improves accuracy)
SPECIES_OBJECTS      Comma-sep Frigate labels to ID
                     (default: bird,cat,dog,deer,bear,raccoon,fox,squirrel)
MIN_SPECIES_SCORE    Minimum confidence 0–1  (default: 0.70)
SPECIES_COOLDOWN     Seconds before re-alerting same species+camera
                     (default: 1800 = 30 min)
MQTT_HOST            MQTT broker host  (default: mosquitto)
MQTT_PORT            MQTT broker port  (default: 1883)
NTFY_URL             ntfy server URL   (default: http://ntfy:80)
NTFY_TOPIC           ntfy topic        (default: frigate-alerts)
FRIGATE_URL          Frigate base URL  (default: http://frigate:5000)
LOG_FILE             Path for sightings log (default: /data/sightings.log)
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
    format="%(asctime)s [species] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("species")

# ── Settings ──────────────────────────────────────────────────────────────────

INAT_TOKEN   = os.getenv("INAT_TOKEN", "")
INAT_LAT     = os.getenv("INAT_LAT", "")
INAT_LNG     = os.getenv("INAT_LNG", "")

MQTT_HOST    = os.getenv("MQTT_HOST",   "mosquitto")
MQTT_PORT    = int(os.getenv("MQTT_PORT", "1883"))
NTFY_URL     = os.getenv("NTFY_URL",    "http://ntfy:80").rstrip("/")
NTFY_TOPIC   = os.getenv("NTFY_TOPIC",  "frigate-alerts")
FRIGATE_URL  = os.getenv("FRIGATE_URL", "http://frigate:5000").rstrip("/")
LOG_FILE     = os.getenv("LOG_FILE",    "/data/sightings.log")

_objects_str    = os.getenv("SPECIES_OBJECTS", "bird,cat,dog,deer,bear,raccoon,fox,squirrel")
SPECIES_OBJECTS = set(o.strip() for o in _objects_str.split(",") if o.strip())
MIN_SCORE       = float(os.getenv("MIN_SPECIES_SCORE", "0.70"))
COOLDOWN        = int(os.getenv("SPECIES_COOLDOWN", "1800"))   # 30 min

INAT_API = "https://api.inaturalist.org/v1/computervision/score_image"

# Cooldown tracking: "{camera}:{common_name}" → last alerted unix timestamp
_alerted: dict[str, float] = {}

# ── iNaturalist icons by taxonomic group ──────────────────────────────────────
# Maps iNat's iconic_taxon_name to ntfy tag + emoji prefix

_TAXON_META = {
    "Aves":          ("bird",        "Bird"),
    "Mammalia":      ("chipmunk",    "Mammal"),
    "Reptilia":      ("lizard",      "Reptile"),
    "Amphibia":      ("frog",        "Amphibian"),
    "Actinopterygii":("tropical_fish","Fish"),
    "Insecta":       ("bug",         "Insect"),
    "Arachnida":     ("spider",      "Arachnid"),
    "Plantae":       ("herb",        "Plant"),
    "Fungi":         ("mushroom",    "Fungus"),
}

def _taxon_meta(iconic_name: str) -> tuple[str, str]:
    """Return (ntfy_tag, group_label) for an iNat iconic taxon name."""
    return _TAXON_META.get(iconic_name, ("paw_prints", "Animal"))


# ── Frigate snapshot ──────────────────────────────────────────────────────────

def fetch_snapshot(event_id: str) -> bytes | None:
    try:
        resp = requests.get(
            f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg",
            params={"bbox": 0, "crop": 1},   # crop=1 zooms in on the animal
            timeout=15,
        )
        resp.raise_for_status()
        return resp.content
    except Exception as exc:
        log.warning("Snapshot fetch failed: %s", exc)
        return None


# ── iNaturalist species ID ────────────────────────────────────────────────────

def identify_species(image_bytes: bytes) -> dict | None:
    """
    Send a cropped animal snapshot to iNaturalist computer vision.
    Returns the top result dict or None if identification failed / low confidence.

    Response structure used:
      result["score"]                        – confidence 0-1
      result["taxon"]["preferred_common_name"] – e.g. "Northern Cardinal"
      result["taxon"]["name"]                – e.g. "Cardinalis cardinalis"
      result["taxon"]["rank"]                – e.g. "species", "genus"
      result["taxon"]["iconic_taxon_name"]   – e.g. "Aves", "Mammalia"
    """
    if not INAT_TOKEN:
        log.warning("INAT_TOKEN not set — skipping species ID")
        return None

    headers = {"Authorization": f"Bearer {INAT_TOKEN}"}
    data: dict = {}
    if INAT_LAT and INAT_LNG:
        data["lat"] = INAT_LAT
        data["lng"] = INAT_LNG

    try:
        resp = requests.post(
            INAT_API,
            files={"file": ("snapshot.jpg", image_bytes, "image/jpeg")},
            data=data,
            headers=headers,
            timeout=20,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
    except Exception as exc:
        log.error("iNaturalist API error: %s", exc)
        return None

    if not results:
        return None

    top = results[0]
    score = top.get("score", 0)
    if score < MIN_SCORE:
        taxon_name = (top.get("taxon") or {}).get("preferred_common_name", "unknown")
        log.info("Top result '%s' at %.0f%% — below threshold", taxon_name, score * 100)
        return None

    return top


# ── Sightings log ─────────────────────────────────────────────────────────────

def log_sighting(common_name: str, scientific: str, camera: str, score: float) -> None:
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"{ts}\t{camera}\t{common_name}\t{scientific}\t{score:.0%}\n")
    except Exception as exc:
        log.error("Log write failed: %s", exc)


# ── ntfy notification ─────────────────────────────────────────────────────────

def send_alert(
    common_name: str,
    scientific: str,
    rank: str,
    iconic: str,
    camera: str,
    score: float,
    image: bytes,
) -> None:
    tag, group = _taxon_meta(iconic)
    camera_name = camera.replace("_", " ").title()

    # For species-level IDs show scientific name; for genus/family just show group
    if rank == "species":
        title = f"{common_name} at {camera_name}"
        body  = f"{scientific} · {score:.0%} confidence"
    else:
        # Couldn't get to species level — show what we do know
        title = f"{group} at {camera_name}"
        body  = f"{common_name or scientific} · {score:.0%} (identified to {rank} level)"

    try:
        resp = requests.put(
            f"{NTFY_URL}/{NTFY_TOPIC}",
            data=image,
            headers={
                "Title":    title,
                "Message":  body,
                "Priority": "low",
                "Tags":     tag,
                "Filename": f"{common_name.lower().replace(' ', '-')}.jpg",
                "Click":    f"{FRIGATE_URL}/events?camera={camera}",
            },
            timeout=20,
        )
        log.info("ntfy %s: %s", "OK" if resp.ok else resp.status_code, title)
    except Exception as exc:
        log.error("ntfy send failed: %s", exc)


# ── Event processing ──────────────────────────────────────────────────────────

def handle_event(payload: dict) -> None:
    ev_type = payload.get("type")
    after   = payload.get("after") or {}
    label   = after.get("label", "")
    camera  = after.get("camera", "unknown")

    # Wait for event to end so Frigate has selected the best snapshot
    if ev_type != "end":
        return
    if label not in SPECIES_OBJECTS:
        return

    event_id = after.get("id") or ""
    if not event_id:
        return

    log.info("%s event ended at %s — identifying species ...", label, camera)

    snapshot = fetch_snapshot(event_id)
    if not snapshot:
        return

    result = identify_species(snapshot)
    if not result:
        log.info("No confident species ID for %s at %s", label, camera)
        return

    taxon       = result.get("taxon") or {}
    common_name = taxon.get("preferred_common_name") or taxon.get("name", "Unknown")
    scientific  = taxon.get("name", "")
    rank        = taxon.get("rank", "")
    iconic      = taxon.get("iconic_taxon_name", "")
    score       = result.get("score", 0)

    log.info("Identified: %s (%s) at %s — %.0f%%", common_name, scientific, camera, score * 100)

    # Cooldown per camera + species to avoid repeat alerts when the same
    # bird hangs out at the feeder for an hour
    key  = f"{camera}:{common_name.lower()}"
    last = _alerted.get(key, 0)
    if time.time() - last < COOLDOWN:
        remaining = int(COOLDOWN - (time.time() - last)) // 60
        log.info("Cooldown: %s (%d min remaining)", common_name, remaining)
        return

    _alerted[key] = time.time()
    log_sighting(common_name, scientific, camera, score)
    send_alert(common_name, scientific, rank, iconic, camera, score, snapshot)


# ── MQTT client ───────────────────────────────────────────────────────────────

def on_connect(client, _userdata, _flags, rc):
    if rc == 0:
        log.info("Connected to MQTT %s:%s", MQTT_HOST, MQTT_PORT)
        client.subscribe("frigate/events")
    else:
        log.error("MQTT connect failed: rc=%d", rc)


def on_message(_client, _userdata, msg):
    try:
        handle_event(json.loads(msg.payload))
    except Exception as exc:
        log.error("Message error: %s", exc)


def main() -> None:
    log.info("Wildlife species ID service starting")
    log.info("Watching for: %s", SPECIES_OBJECTS)
    log.info("Min confidence: %.0f%%  |  Cooldown: %ds", MIN_SCORE * 100, COOLDOWN)
    if INAT_LAT and INAT_LNG:
        log.info("Location hint: %s, %s", INAT_LAT, INAT_LNG)
    else:
        log.info("No location set — add INAT_LAT/INAT_LNG to .env for better accuracy")
    if not INAT_TOKEN:
        log.warning("INAT_TOKEN not set — get one at https://www.inaturalist.org/users/api_token")

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
