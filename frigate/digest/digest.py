"""
Daily digest service — sends a morning summary notification.

Every day at DIGEST_HOUR (default 8am), fetches yesterday's events from
Frigate and sends a notification with:

  1. Text summary:  "14 people · 3 cars · 1 package"
  2. Twin composite image: every unique person position from the day cut out
     at full opacity and pasted onto a single background frame — so it
     literally looks like there are multiple clones of you in the yard.
     Falls back to a thumbnail grid if there are only 1-2 detections.

Settings are all environment variables — no editing needed.
"""

import io
import os
import time
from datetime import datetime, timedelta

import requests
from PIL import Image, ImageDraw, ImageOps

# ── Settings ──────────────────────────────────────────────────────────────────

FRIGATE_URL   = os.getenv("FRIGATE_URL",   "http://frigate:5000").rstrip("/")
NTFY_URL      = os.getenv("NTFY_URL",      "http://ntfy:80").rstrip("/")
NTFY_TOPIC    = os.getenv("NTFY_TOPIC",    "frigate-alerts")
DIGEST_HOUR   = int(os.getenv("DIGEST_HOUR",   "8"))   # 8 = 8:00 AM local time
MAX_SNAPSHOTS = int(os.getenv("MAX_SNAPSHOTS", "20"))  # cap for twin composite

# TWIN_CAMERAS: comma-separated list of camera names to use for the twin
# composite.  Only list static (non-pan) cameras here — if a PTZ/pan camera
# is included the background shifts between snapshots and the composite looks
# wrong.  Leave empty to use all cameras.
# Example: TWIN_CAMERAS=front_door,backyard
_twin_cams_raw = os.getenv("TWIN_CAMERAS", "")
TWIN_CAMERAS   = {c.strip() for c in _twin_cams_raw.split(",") if c.strip()}

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
    """Full-frame snapshot, no bounding box drawn — clean for compositing."""
    try:
        resp = requests.get(
            f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg",
            params={"bbox": 0, "crop": 0},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None


# ── Image generators ──────────────────────────────────────────────────────────

def make_twin_composite(events: list[dict], snapshots: list[bytes]) -> bytes | None:
    """
    Full-opacity 'twins' composite.

    Every unique person position is cropped out of its own snapshot and
    pasted onto a shared background at 100% opacity.  The result looks like
    multiple clones of the same person standing in the yard at once.

    Algorithm:
      1. Use the first snapshot as the background frame.
      2. For each subsequent event, read the bounding box from the Frigate
         event JSON (normalized [x_min, y_min, x_max, y_max] in 0-1 range).
      3. Skip positions that are too close to an already-placed person so
         we don't stack duplicates on top of each other.
      4. Crop the person region (+ padding) from that event's snapshot.
      5. Paste it onto the base at full opacity.
    """
    pairs = [(e, s) for e, s in zip(events, snapshots) if s is not None]
    if not pairs:
        return None

    # Background = first snapshot
    try:
        base = Image.open(io.BytesIO(pairs[0][1])).convert("RGB")
    except Exception:
        return None

    W, H = base.size
    placed: list[tuple[int, int]] = []   # centers of already-pasted crops

    for event, snap_data in pairs[1:]:
        box = event.get("box") or []
        if len(box) < 4:
            continue   # no bounding box — skip

        try:
            snap = Image.open(io.BytesIO(snap_data)).convert("RGB")
            snap = snap.resize((W, H), Image.LANCZOS)

            # Frigate stores box as [x_min, y_min, x_max, y_max] normalized
            x1 = int(box[0] * W)
            y1 = int(box[1] * H)
            x2 = int(box[2] * W)
            y2 = int(box[3] * H)

            # Guard against degenerate boxes
            if x2 <= x1 or y2 <= y1:
                continue

            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

            # Skip if another person is already pasted very close to here
            # (threshold: 15% of frame width / height)
            if any(
                abs(cx - px) < W * 0.15 and abs(cy - py) < H * 0.15
                for px, py in placed
            ):
                continue

            # Add 15% padding around the bounding box so we include feet/head
            pw = int((x2 - x1) * 0.15)
            ph = int((y2 - y1) * 0.15)
            x1, y1 = max(0, x1 - pw), max(0, y1 - ph)
            x2, y2 = min(W, x2 + pw), min(H, y2 + ph)

            person_crop = snap.crop((x1, y1, x2, y2))
            base.paste(person_crop, (x1, y1))
            placed.append((cx, cy))

        except Exception as exc:
            print(f"[digest] Composite paste error: {exc}")

    # Label
    draw = ImageDraw.Draw(base)
    label = f"All {len(placed) + 1} positions — yesterday"
    draw.text((14, 14), label, fill=(0,   0,   0  ))   # shadow
    draw.text((12, 12), label, fill=(255, 255, 255))

    out = io.BytesIO()
    base.save(out, format="JPEG", quality=90)
    return out.getvalue()


def make_snapshot_grid(snapshots: list[bytes]) -> bytes | None:
    """Thumbnail grid — fallback when there aren't enough unique positions."""
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
        if label == "person" and not ev.get("sub_label"):
            stranger_count += 1

    summary_parts = []
    for label, n in sorted(counts.items(), key=lambda x: -x[1]):
        noun = label.replace("_", " ").title()
        summary_parts.append(f"{n} {noun}{'s' if n > 1 else ''}")

    body_lines = [" · ".join(summary_parts)]
    if stranger_count > 0:
        body_lines.append(
            f"  {stranger_count} unrecognized person{'s' if stranger_count > 1 else ''}"
            " — check Frigate for clips"
        )

    # ── Build twin composite ─────────────────────────────────────────────────
    person_events = [
        e for e in events
        if e.get("label") == "person"
        # Exclude pan/PTZ cameras — background shifts when camera moves, which
        # breaks the composite.  Set TWIN_CAMERAS in .env to restrict to static
        # cameras only (e.g. TWIN_CAMERAS=front_door,backyard).
        and (not TWIN_CAMERAS or e.get("camera") in TWIN_CAMERAS)
    ]

    # Sort by score desc so we get the sharpest snapshots first; then
    # the position-deduplication logic keeps the most spread-out set.
    person_events.sort(key=lambda e: e.get("top_score") or 0, reverse=True)
    top_events = person_events[:MAX_SNAPSHOTS]

    print(f"[digest] {len(events)} total events, downloading {len(top_events)} person snapshots ...")
    snapshots = [fetch_snapshot(e["id"]) for e in top_events]
    valid = sum(1 for s in snapshots if s)
    print(f"[digest] Got {valid} snapshots")

    # Need at least 2 snapshots (one background + one person to paste)
    if valid >= 2:
        image = make_twin_composite(top_events, snapshots)
        print("[digest] Twin composite ready")
    elif valid == 1:
        image = make_snapshot_grid([s for s in snapshots if s])
        print("[digest] Single snapshot (no composite possible)")
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
