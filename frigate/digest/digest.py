"""
Daily digest service — sends a morning summary notification.

Every day at DIGEST_HOUR (default 8am), fetches yesterday's events from
Frigate and sends two notifications:

  1. Text summary:  "14 people · 3 cars · 1 package  |  2 strangers"
  2. Ghost composite image: every person snapshot from the day overlaid on
     top of each other — you can see every position a person was detected,
     making it look like there are multiple people in the yard at once.
     Falls back to a thumbnail grid if there are only 1-2 detections.

Settings are all environment variables — no editing needed.
"""

import io
import os
import time
from datetime import datetime, timedelta

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

# ── Settings ──────────────────────────────────────────────────────────────────

FRIGATE_URL   = os.getenv("FRIGATE_URL",   "http://frigate:5000").rstrip("/")
NTFY_URL      = os.getenv("NTFY_URL",      "http://ntfy:80").rstrip("/")
NTFY_TOPIC    = os.getenv("NTFY_TOPIC",    "frigate-alerts")
DIGEST_HOUR   = int(os.getenv("DIGEST_HOUR",   "8"))   # 8 = 8:00 AM local time
MAX_SNAPSHOTS = int(os.getenv("MAX_SNAPSHOTS", "20"))  # cap for composite/grid

# ── Frigate API ───────────────────────────────────────────────────────────────

def get_events(after: float, before: float) -> list[dict]:
    try:
        resp = requests.get(
            f"{FRIGATE_URL}/api/events",
            params={"after": after, "before": before, "limit": 1000},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[digest] Failed to fetch events: {exc}")
        return []


def fetch_snapshot(event_id: str) -> bytes | None:
    try:
        resp = requests.get(
            f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg",
            params={"bbox": 0, "crop": 0},   # full frame, no crop — needed for ghost effect
            timeout=15,
        )
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None


# ── Image generators ──────────────────────────────────────────────────────────

def make_ghost_composite(snapshots: list[bytes]) -> bytes | None:
    """
    Overlay every snapshot with transparency to create the ghost effect.

    Each frame is blended at low opacity so when you have 10 person
    detections throughout the day, they all show up semi-transparently
    in their positions — like a long-exposure photo of the yard.
    """
    if not snapshots:
        return None

    images = []
    for data in snapshots:
        try:
            images.append(Image.open(io.BytesIO(data)).convert("RGBA"))
        except Exception:
            continue

    if not images:
        return None

    # Normalise size to the first image
    w, h = images[0].size
    images = [img.resize((w, h), Image.LANCZOS) for img in images]

    # Start from the first frame as the background
    composite = images[0].copy()

    # Per-image alpha: fewer images → each one is more opaque so they're
    # still visible; more images → lower alpha so they don't all wash out.
    per_alpha = max(25, min(110, 180 // len(images)))

    for img in images[1:]:
        r, g, b, a = img.split()
        a = a.point(lambda x: int(x * per_alpha / 255))
        overlay = Image.merge("RGBA", (r, g, b, a))
        composite = Image.alpha_composite(composite, overlay)

    # Stamp a label in the corner so it's clear what this is
    draw = ImageDraw.Draw(composite)
    label = "All detections — yesterday"
    draw.text((12, 12), label, fill=(255, 255, 255, 180))
    draw.text((11, 11), label, fill=(0, 0, 0, 120))  # shadow

    out = io.BytesIO()
    composite.convert("RGB").save(out, format="JPEG", quality=85)
    return out.getvalue()


def make_snapshot_grid(snapshots: list[bytes]) -> bytes | None:
    """Grid of event thumbnails — used when there are only 1-2 detections."""
    if not snapshots:
        return None

    THUMB = (320, 180)
    PAD   = 4
    cols  = min(4, len(snapshots))
    rows  = (len(snapshots) + cols - 1) // cols

    grid = Image.new(
        "RGB",
        (PAD + cols * (THUMB[0] + PAD), PAD + rows * (THUMB[1] + PAD)),
        (15, 15, 15),
    )

    for i, data in enumerate(snapshots):
        try:
            thumb = ImageOps.fit(
                Image.open(io.BytesIO(data)).convert("RGB"),
                THUMB, method=Image.LANCZOS,
            )
            col, row = i % cols, i // cols
            grid.paste(thumb, (PAD + col * (THUMB[0] + PAD), PAD + row * (THUMB[1] + PAD)))
        except Exception:
            continue

    out = io.BytesIO()
    grid.save(out, format="JPEG", quality=85)
    return out.getvalue()


# ── ntfy sender ───────────────────────────────────────────────────────────────

def send_digest(title: str, body: str, image: bytes | None) -> None:
    headers = {
        "Title":    title,
        "Priority": "low",
        "Tags":     "camera,sunrise",
        "Click":    f"{FRIGATE_URL}/events",
    }
    try:
        if image:
            # PUT with binary body uploads the image directly to ntfy's
            # attachment cache so the phone can fetch it over Tailscale.
            resp = requests.put(
                f"{NTFY_URL}/{NTFY_TOPIC}",
                data=image,
                headers={
                    **headers,
                    "Filename": "daily-activity.jpg",
                    "Message":  body,
                },
                timeout=30,
            )
        else:
            resp = requests.post(
                f"{NTFY_URL}/{NTFY_TOPIC}",
                data=body.encode(),
                headers=headers,
                timeout=15,
            )
        print(f"[digest] {'Sent' if resp.ok else f'ntfy {resp.status_code}'}: {title}")
    except Exception as exc:
        print(f"[digest] Send failed: {exc}")


# ── Main digest logic ─────────────────────────────────────────────────────────

def run_digest() -> None:
    now       = datetime.now()
    yesterday = now - timedelta(days=1)

    day_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    day_end   = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)

    print(f"[digest] Running for {yesterday.strftime('%Y-%m-%d')} ...")
    events = get_events(day_start.timestamp(), day_end.timestamp())

    date_str = yesterday.strftime("%a, %b %-d")
    title    = f"Yesterday's cameras — {date_str}"

    if not events:
        send_digest(f"All quiet — {date_str}", "No motion events detected yesterday.", None)
        return

    # ── Count by label ───────────────────────────────────────────────────────
    counts: dict[str, int] = {}
    stranger_count = 0
    for ev in events:
        label = ev.get("label", "unknown")
        counts[label] = counts.get(label, 0) + 1
        if label == "person":
            stranger_count += 1   # will subtract known below (best estimate)

    summary_parts = []
    for label, n in sorted(counts.items(), key=lambda x: -x[1]):
        noun = label.replace("_", " ").title()
        summary_parts.append(f"{n} {noun}{'s' if n > 1 else ''}")

    body_lines = [" · ".join(summary_parts)]
    if stranger_count > 0:
        body_lines.append(f"  {stranger_count} unrecognized person{'s' if stranger_count > 1 else ''} — check Frigate for clips")

    # ── Build ghost composite ────────────────────────────────────────────────
    person_events = [e for e in events if e.get("label") == "person"]
    # Best detections first (most confident = cleanest snapshot)
    person_events.sort(key=lambda e: e.get("top_score") or 0, reverse=True)
    top = person_events[:MAX_SNAPSHOTS]

    print(f"[digest] {len(events)} events total, downloading {len(top)} person snapshots ...")
    snapshots = [s for e in top if (s := fetch_snapshot(e["id"])) is not None]
    print(f"[digest] Got {len(snapshots)} snapshots")

    if len(snapshots) >= 3:
        image = make_ghost_composite(snapshots)
        print("[digest] Ghost composite ready")
    elif snapshots:
        image = make_snapshot_grid(snapshots)
        print("[digest] Snapshot grid ready (< 3 images, no ghost)")
    else:
        image = None
        print("[digest] No snapshots available")

    send_digest(title, "\n".join(body_lines), image)


# ── Schedule loop ─────────────────────────────────────────────────────────────

def main() -> None:
    print(f"[digest] Starting — daily digest at {DIGEST_HOUR:02d}:00")
    print(f"[digest] Frigate: {FRIGATE_URL}")
    print(f"[digest] ntfy:    {NTFY_URL}/{NTFY_TOPIC}")

    while True:
        now      = datetime.now()
        next_run = now.replace(hour=DIGEST_HOUR, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)

        wait = (next_run - now).total_seconds()
        print(f"[digest] Next digest in {wait / 3600:.1f} h  ({next_run.strftime('%Y-%m-%d %H:%M')})")
        time.sleep(wait)

        try:
            run_digest()
        except Exception as exc:
            print(f"[digest] Unhandled error: {exc}")


if __name__ == "__main__":
    main()
