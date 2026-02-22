#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Frigate NVR — one-time setup wizard
#
#  Run from the frigate/ directory:
#    bash setup.sh
#
#  What this does:
#    1. Checks / installs Docker
#    2. Asks you a few questions (camera IPs, Wyze password, your names)
#    3. Writes a .env file — docker-compose reads it automatically
#    4. Starts all services
#    5. Installs Tailscale for secure phone access
#    6. Prints URLs for everything
#
#  Re-running this script is safe — it just updates your .env and restarts.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")"

# ── Terminal colors ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; CYAN='\033[0;36m'
else
  BOLD=''; DIM=''; NC=''
  GREEN=''; YELLOW=''; BLUE=''; RED=''; CYAN=''
fi

ok()      { echo -e "${GREEN}  ✓${NC}  $*"; }
info()    { echo -e "${BLUE}  →${NC}  $*"; }
warn()    { echo -e "${YELLOW}  !${NC}  $*"; }
err()     { echo -e "${RED}  ✗${NC}  $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▸ $*${NC}"; }
divider() { echo -e "\n${DIM}──────────────────────────────────────────────────${NC}"; }
ask()     { echo -e "  ${BOLD}$*${NC}"; }

# ── Ctrl+C handler ────────────────────────────────────────────────────────────
trap 'echo -e "\n\n  Setup cancelled."; exit 1' INT

# ── Utilities ─────────────────────────────────────────────────────────────────

# Generate a random hard-to-guess string (for ntfy topic)
gen_token() {
  python3 -c "import secrets, string; print(secrets.token_urlsafe(10))" 2>/dev/null ||
  tr -dc 'a-z0-9' </dev/urandom | head -c 12 2>/dev/null ||
  echo "cam-$(date +%s | tail -c6)"
}

# Detect the user's timezone
detect_timezone() {
  timedatectl show --property=Timezone --value 2>/dev/null ||
  cat /etc/timezone 2>/dev/null ||
  readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||' ||
  echo "America/Chicago"
}

# Check if a host:port is reachable (3s timeout)
is_reachable() {
  timeout 3 bash -c "</dev/tcp/$1/$2" 2>/dev/null
}

# Determine docker compose command (v2 plugin or v1 standalone)
docker_compose() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    err "docker compose not found. Install Docker Desktop and try again."
  fi
}

# ── Welcome banner ─────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║          Frigate NVR — Setup Wizard              ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Answers to ~8 questions → everything configured and running."
echo "  Takes about 5 minutes (most of that is Docker downloading images)."
echo ""

# ── Step 1: Docker ────────────────────────────────────────────────────────────
step "Checking Docker"

if ! command -v docker &>/dev/null; then
  warn "Docker not found. Installing..."
  echo ""
  if [[ "$(uname)" == "Darwin" ]]; then
    err "On Mac, install Docker Desktop from https://www.docker.com/products/docker-desktop then re-run this script."
  fi
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  warn "Docker installed. You may need to log out and back in."
  warn "If 'docker compose' fails with a permissions error, prefix commands with 'sudo'."
fi

if ! docker info &>/dev/null 2>&1; then
  if sudo docker info &>/dev/null 2>&1; then
    warn "Docker requires sudo on this machine. Continuing with sudo."
    DOCKER_SUDO="sudo "
  else
    err "Docker is installed but not running. Start Docker Desktop (or: sudo systemctl start docker) then re-run this script."
  fi
else
  DOCKER_SUDO=""
fi
ok "Docker is ready"

# ── Step 2: Wyze RTSP credentials ─────────────────────────────────────────────
step "Wyze RTSP credentials"
echo ""
echo "  Find these in: Wyze app → Camera → Settings → Advanced Settings → RTSP"
echo "  (If you don't see RTSP, you may need to install the Wyze RTSP firmware first)"
echo ""

ask "  RTSP username (press Enter for default 'wyze'):"
read -rp "  > " RTSP_USER
RTSP_USER="${RTSP_USER:-wyze}"

ask "  RTSP password:"
read -rsp "  > " RTSP_PASSWORD
echo ""
[[ -z "$RTSP_PASSWORD" ]] && err "Password cannot be empty."

echo ""
ask "  Stream path — which works for your Wyze model?"
echo "    1) /live           (Wyze Cam v2, v3, Pan — most common)"
echo "    2) /livestream/12  (some older Wyze models)"
echo "    3) Other"
read -rp "  > [1]: " PATH_CHOICE
case "${PATH_CHOICE:-1}" in
  2) RTSP_PATH="/livestream/12" ;;
  3)
    ask "    Enter your RTSP path (starting with /):"
    read -rp "    > " RTSP_PATH
    ;;
  *) RTSP_PATH="/live" ;;
esac

ok "RTSP: ${RTSP_USER}@camera${RTSP_PATH}"

# ── Step 3: Camera IPs ────────────────────────────────────────────────────────
step "Camera IP addresses"
echo ""
echo "  Find each camera's IP in: Wyze app → Camera → Settings → Device Info"
echo ""

ask "  How many cameras? (1–4):"
read -rp "  > [2]: " NUM_CAMS
NUM_CAMS="${NUM_CAMS:-2}"
[[ "$NUM_CAMS" =~ ^[1-4]$ ]] || err "Please enter 1, 2, 3, or 4."

declare -a CAM_IPS=()
declare -a CAM_NAMES=()
declare -a CAM_PTZES=()   # "y" or "n" for each camera
HAS_PTZ=false
DEFAULT_NAMES=("front_door" "backyard" "garage" "side_yard")
DEFAULT_LABELS=("Front Door / Driveway" "Backyard" "Garage" "Side Yard")

for (( i=0; i<NUM_CAMS; i++ )); do
  NUM=$((i+1))
  echo ""
  ask "  Camera $NUM — ${DEFAULT_LABELS[$i]}"

  # Name
  ask "    Name (no spaces, used as the camera ID):"
  read -rp "    > [${DEFAULT_NAMES[$i]}]: " CAM_NAME
  CAM_NAME="${CAM_NAME:-${DEFAULT_NAMES[$i]}}"
  CAM_NAME="${CAM_NAME// /_}"   # spaces → underscores
  CAM_NAMES+=("$CAM_NAME")

  # IP
  while true; do
    ask "    IP address:"
    read -rp "    > " CAM_IP
    if [[ "$CAM_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      if is_reachable "$CAM_IP" 554; then
        ok "    $CAM_IP is reachable on RTSP port 554"
      else
        warn "    Can't reach $CAM_IP:554 right now. Continuing anyway — verify RTSP is enabled."
      fi
      CAM_IPS+=("$CAM_IP")
      break
    else
      warn "    That doesn't look like a valid IP. Try again (format: 192.168.1.100)"
    fi
  done

  # PTZ
  ask "    Pan/tilt camera (Wyze Pan Cam — can physically rotate)? [y/N]:"
  read -rp "    > " IS_PTZ
  IS_PTZ="${IS_PTZ:-n}"
  CAM_PTZES+=("$IS_PTZ")
  if [[ "$IS_PTZ" =~ ^[Yy] ]]; then
    HAS_PTZ=true
    ok "    PTZ enabled — Frigate will auto-track people on this camera"
  fi
done

# ── Step 4: GPU / hardware acceleration ──────────────────────────────────────
step "Hardware acceleration"
echo ""
echo "  Lets Frigate use your GPU for video decoding — saves CPU, runs cooler."
echo "  If unsure, pick 'None'. You can always change it later."
echo ""
echo "    1) None — CPU only    (always works, safe default)"
echo "    2) Intel integrated GPU  (Intel HD / Iris / Arc graphics)"
echo "    3) NVIDIA GPU"
echo "    4) Raspberry Pi 4 / 5"
read -rp "  > [1]: " GPU_CHOICE
case "${GPU_CHOICE:-1}" in
  2) HW_ACCEL="preset-intel-qsv-h264" ;;
  3) HW_ACCEL="preset-nvidia-h264" ;;
  4) HW_ACCEL="preset-rpi-64-h264" ;;
  *) HW_ACCEL="" ;;
esac
[[ -n "$HW_ACCEL" ]] && ok "Hardware accel: $HW_ACCEL" || ok "CPU-only decode"

# ── Step 5: Recordings storage ────────────────────────────────────────────────
step "Recordings storage"
echo ""
echo "  Where should Frigate save recordings and snapshots?"
echo "  Needs a few GB free minimum; 500GB+ is comfortable for 2 cameras."
echo ""
ask "  Storage path (press Enter for ./storage in this folder):"
echo "  ${DIM}Example for a second drive: /mnt/bigdrive/frigate${NC}"
read -rp "  > [./storage]: " STORAGE_PATH
STORAGE_PATH="${STORAGE_PATH:-./storage}"

# Create directory if it doesn't exist
mkdir -p "$STORAGE_PATH"
ok "Storage: $STORAGE_PATH"

# ── Step 6: Face recognition names ───────────────────────────────────────────
step "Face recognition — family names"
echo ""
echo "  After setup, you'll train the system with your photos."
echo "  People listed here get a quiet 'arrived home' alert instead of a stranger warning."
echo "  Use lowercase. Leave blank and add later if you prefer."
echo ""
ask "  Your first name:"
read -rp "  > " NAME1

ask "  Your wife's first name:"
read -rp "  > " NAME2

KNOWN_PEOPLE=""
[[ -n "$NAME1" ]] && KNOWN_PEOPLE="${NAME1,,}"
[[ -n "$NAME2" ]] && KNOWN_PEOPLE="${KNOWN_PEOPLE:+${KNOWN_PEOPLE},}${NAME2,,}"
[[ -n "$KNOWN_PEOPLE" ]] && ok "Family: $KNOWN_PEOPLE" || info "No names set yet — add them after training"

# ── Step 7: Timezone ──────────────────────────────────────────────────────────
step "Timezone"
echo ""
DETECTED_TZ="$(detect_timezone)"
ask "  Timezone (for accurate event timestamps):"
read -rp "  > [${DETECTED_TZ}]: " TIMEZONE
TIMEZONE="${TIMEZONE:-$DETECTED_TZ}"
ok "Timezone: $TIMEZONE"

# ── Step 8: ntfy topic ────────────────────────────────────────────────────────
step "Push notification topic"
echo ""
echo "  This is your private notification channel name."
echo "  Treat it like a password — anyone who knows it can subscribe."
echo "  We've generated a random one for you."
echo ""
RANDOM_TOPIC="cam-$(gen_token)"
ask "  Topic name:"
read -rp "  > [${RANDOM_TOPIC}]: " NTFY_TOPIC
NTFY_TOPIC="${NTFY_TOPIC:-$RANDOM_TOPIC}"
ok "Topic: $NTFY_TOPIC"

# ── Confirm ────────────────────────────────────────────────────────────────────
divider
echo ""
echo -e "  ${BOLD}Ready to set up with these settings:${NC}"
echo ""
echo "    RTSP user:     $RTSP_USER"
echo "    RTSP path:     $RTSP_PATH"
echo "    Cameras:"
for (( i=0; i<NUM_CAMS; i++ )); do
  PTZ_LABEL=""
  [[ "${CAM_PTZES[$i]}" =~ ^[Yy] ]] && PTZ_LABEL="  (pan/tilt + autotracking)"
  printf "      %-18s  →  %s%s\n" "${CAM_NAMES[$i]}" "${CAM_IPS[$i]}" "$PTZ_LABEL"
done
[[ -n "$HW_ACCEL" ]] && echo "    GPU accel:     $HW_ACCEL" || echo "    GPU accel:     CPU only"
echo "    Storage:       $STORAGE_PATH"
echo "    Family names:  ${KNOWN_PEOPLE:-not set yet}"
echo "    Timezone:      $TIMEZONE"
echo "    ntfy topic:    $NTFY_TOPIC"
echo ""
read -rp "  Start setup? [Y/n]: " CONFIRM
[[ "${CONFIRM:-Y}" =~ ^[Nn] ]] && { echo "  Cancelled."; exit 0; }

# ── Write .env ────────────────────────────────────────────────────────────────
step "Writing configuration"

# Get the host's LAN IP (for Scrypted → Frigate connection instructions)
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "YOUR_LAN_IP")

cat > .env << EOF
# Generated by setup.sh — do not commit this file
# Edit values here and run: docker compose up -d

# ── Camera credentials ────────────────────────────────────────────────────────
RTSP_USER=${RTSP_USER}
RTSP_PASSWORD=${RTSP_PASSWORD}
RTSP_PATH=${RTSP_PATH}

# ── Camera IPs ────────────────────────────────────────────────────────────────
EOF

for (( i=0; i<NUM_CAMS; i++ )); do
  echo "CAM$((i+1))_IP=${CAM_IPS[$i]}" >> .env
done
# Pad to 4 cameras (unused ones will be empty, Frigate ignores empty env vars)
for (( i=NUM_CAMS; i<4; i++ )); do
  echo "CAM$((i+1))_IP=" >> .env
done

# PTZ flags (used by config generation below)
echo "" >> .env
echo "# ── PTZ auto-tracking ────────────────────────────────────────────────────────" >> .env
for (( i=0; i<NUM_CAMS; i++ )); do
  echo "CAM$((i+1))_PTZ=${CAM_PTZES[$i]}" >> .env
done

cat >> .env << EOF

# ── Notifications ─────────────────────────────────────────────────────────────
NTFY_TOPIC=${NTFY_TOPIC}
# Updated automatically when Tailscale is set up:
NTFY_BASE_URL=http://localhost:8080
FRIGATE_URL=http://frigate:5000

# ── Face recognition ──────────────────────────────────────────────────────────
KNOWN_PEOPLE=${KNOWN_PEOPLE}

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_PATH=${STORAGE_PATH}
EOF

ok ".env written"

# ── Update config/config.yml with camera names and hardware accel ─────────────
info "Updating Frigate config..."

# Regenerate the go2rtc streams and cameras sections for the actual camera names
CAM_PTZES_STR="${CAM_PTZES[*]}"   # "y n y n" etc.
python3 - << PYEOF
import re

with open('config/config.yml', 'r') as f:
    content = f.read()

cam_names_raw  = "${CAM_NAMES[*]}"
cam_ptzes_raw  = "${CAM_PTZES_STR}"
cam_count      = $NUM_CAMS

cam_names_list = cam_names_raw.split()
cam_ptzes_list = cam_ptzes_raw.split() if cam_ptzes_raw.strip() else []

def is_ptz(i):
    return i < len(cam_ptzes_list) and cam_ptzes_list[i].lower() in ('y', 'yes')

# ── go2rtc streams ──────────────────────────────────────────────────────────
streams = "go2rtc:\n  streams:\n\n    # Camera IPs come from .env — no editing needed.\n"
for i, name in enumerate(cam_names_list):
    streams += f"    {name}:\n"
    streams += f'      - "rtsp://{{FRIGATE_RTSP_USER}}:{{FRIGATE_RTSP_PASSWORD}}@{{FRIGATE_CAM{i+1}_IP}}{{FRIGATE_RTSP_PATH}}"\n\n'

content = re.sub(
    r'^go2rtc:.*?(?=^[a-z])',
    streams + "\n",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# ── cameras section ──────────────────────────────────────────────────────────
cam_section = "# ── Cameras ───────────────────────────────────────────────────────────────────\ncameras:\n\n"

for i, name in enumerate(cam_names_list):
    ptz = is_ptz(i)

    cam_section += f"  {name}:\n"
    cam_section += "    <<: *camera_defaults\n\n"
    cam_section += "    ffmpeg:\n"
    cam_section += "      inputs:\n"
    cam_section += f"        - path: rtsp://127.0.0.1:8554/{name}\n"
    cam_section += "          roles: [detect, record]\n\n"

    if ptz:
        # ONVIF PTZ control — Wyze Pan Cam uses port 2020 (not the ONVIF standard 80)
        cam_section += "    onvif:\n"
        cam_section += f"      host: {{FRIGATE_CAM{i+1}_IP}}\n"
        cam_section += "      port: 2020\n"
        cam_section += "      user: \"{FRIGATE_RTSP_USER}\"\n"
        cam_section += "      password: \"{FRIGATE_RTSP_PASSWORD}\"\n\n"
        # Frigate autotracking — moves the camera to follow detected people
        cam_section += "    autotracking:\n"
        cam_section += "      enabled: true\n"
        cam_section += "      calibrate_on_startup: true   # finds pan/tilt limits on first start\n"
        cam_section += "      zooming: disabled             # Wyze Pan has no optical zoom\n"
        cam_section += "      track:\n"
        cam_section += "        - person\n"
        cam_section += "      timeout: 10                  # seconds idle before returning home\n"
        cam_section += "      # return_preset: home        # uncomment after setting a 'home' preset in Frigate UI\n\n"
        cam_section += "    zones:\n"
        cam_section += "      # Note: zones are less reliable with PTZ cameras because the\n"
        cam_section += "      # field of view shifts as the camera tracks. Alert on full-frame\n"
        cam_section += "      # detections, or set REQUIRE_ZONE=false in .env for PTZ cameras.\n\n\n"
    else:
        cam_section += "    zones:\n"
        cam_section += "      # Draw zones in the Frigate UI, then paste coordinates here.\n"
        cam_section += "      # driveway:\n"
        cam_section += "      #   coordinates: 0,1080,1920,1080,1920,400,0,400\n"
        cam_section += "      #   objects: [person, car]\n\n\n"

content = re.sub(
    r'^# ── Cameras.*',
    cam_section,
    content,
    flags=re.MULTILINE | re.DOTALL
)

with open('config/config.yml', 'w') as f:
    f.write(content)
PYEOF

# Apply hardware acceleration if selected
if [[ -n "$HW_ACCEL" ]]; then
  sed -i "s|hwaccel_args: \[\]|hwaccel_args: ${HW_ACCEL}|g" config/config.yml
  ok "Hardware accel set to: $HW_ACCEL"
fi

# Update double-take timezone
sed -i "s|timezone: America/Chicago.*|timezone: ${TIMEZONE}    # auto-set by setup.sh|g" double-take/config.yml

# Update double-take cameras to match
python3 - << PYEOF
cam_names = ${CAM_NAMES[@]@Q}

cameras_block = "cameras:\n"
for name in cam_names.split():
    name = name.strip("'")
    cameras_block += f"  {name}:\n"
    cameras_block += "    zones: []\n"

with open('double-take/config.yml', 'r') as f:
    content = f.read()

import re
content = re.sub(r'^cameras:.*', cameras_block, content, flags=re.MULTILINE | re.DOTALL)

with open('double-take/config.yml', 'w') as f:
    f.write(content)
PYEOF

ok "Frigate and Double-Take configs updated"

# ── Start Docker Compose ──────────────────────────────────────────────────────
step "Starting all services"
echo ""
info "Pulling Docker images (this can take a few minutes the first time)..."
echo ""

${DOCKER_SUDO}docker_compose pull --quiet

info "Starting containers..."
${DOCKER_SUDO}docker_compose up -d --build

# Wait for Frigate to become healthy
echo ""
info "Waiting for Frigate to start..."
TRIES=0
until ${DOCKER_SUDO}docker_compose exec -T frigate wget -qO- http://localhost:5000/api/version &>/dev/null; do
  sleep 3
  TRIES=$((TRIES+1))
  [[ $TRIES -gt 30 ]] && { warn "Frigate is taking a while. Check logs: docker compose logs frigate"; break; }
  echo -n "."
done
echo ""
ok "All services are running"

# ── Tailscale ─────────────────────────────────────────────────────────────────
step "Tailscale — secure phone access"
echo ""
echo "  Tailscale creates a private, encrypted connection between this machine"
echo "  and your phones. No port forwarding, nothing exposed to the internet."
echo ""
read -rp "  Set up Tailscale now? [Y/n]: " TS_CONFIRM

if [[ ! "${TS_CONFIRM:-Y}" =~ ^[Nn] ]]; then

  if ! command -v tailscale &>/dev/null; then
    info "Installing Tailscale..."
    if [[ "$(uname)" == "Darwin" ]]; then
      warn "On Mac, install Tailscale from the App Store or https://tailscale.com/download/mac then re-run this script."
    else
      curl -fsSL https://tailscale.com/install.sh | sh
    fi
  fi

  info "Connecting to Tailscale (a browser window will open to log in)..."
  sudo tailscale up --accept-routes

  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")

  if [[ -n "$TS_IP" ]]; then
    ok "Tailscale IP: $TS_IP"

    # Update .env with Tailscale IP so notifications link correctly from phones
    sed -i "s|NTFY_BASE_URL=.*|NTFY_BASE_URL=http://${TS_IP}:8080|" .env
    sed -i "s|FRIGATE_URL=.*|FRIGATE_URL=http://${TS_IP}:5000|" .env

    # Reload the affected services
    info "Reloading notification services with Tailscale IP..."
    ${DOCKER_SUDO}docker_compose up -d ntfy notifier

    ok "Notification links will now work from your phone over Tailscale"
  else
    warn "Couldn't detect Tailscale IP. Run 'tailscale ip -4' after login and update .env manually."
    TS_IP="YOUR_TAILSCALE_IP"
  fi
else
  TS_IP="YOUR_TAILSCALE_IP"
  info "Skipped. Run 'bash tailscale-setup.sh' when ready."
fi

# ── Final summary ──────────────────────────────────────────────────────────────
step "Setup complete!"
echo ""
echo -e "  ${BOLD}Services are running. Here's everything you need:${NC}"
echo ""
echo -e "  ${CYAN}On this machine (local network)${NC}"
printf "    Frigate cameras:   http://%-36s\n" "${LAN_IP}:5000"
printf "    Face training UI:  http://%-36s\n" "${LAN_IP}:3000"
printf "    Scrypted/HomeKit:  https://%-35s\n" "${LAN_IP}:10443"
echo ""
echo -e "  ${CYAN}On your phone (install Tailscale app first)${NC}"
printf "    Frigate cameras:   http://%-36s\n" "${TS_IP}:5000"
printf "    Face training UI:  http://%-36s\n" "${TS_IP}:3000"
printf "    Scrypted/HomeKit:  https://%-35s\n" "${TS_IP}:10443"
echo ""
echo -e "  ${CYAN}Push notifications (install ntfy app)${NC}"
echo "    iOS:      https://apps.apple.com/app/ntfy/id1625396347"
echo "    Android:  https://play.google.com/store/apps/details?id=io.heckel.ntfy"
echo ""
echo "    In the ntfy app:"
echo "      Settings → Default server → http://${TS_IP}:8080"
echo "      Subscribe to topic: ${NTFY_TOPIC}"
echo ""
if [[ "$HAS_PTZ" == "true" ]]; then
  echo -e "  ${CYAN}Pan/tilt auto-tracking${NC}"
  echo "    Frigate will physically move your PTZ cameras to follow detected people."
  echo ""
  echo "    IMPORTANT — disable Wyze's built-in tracking to avoid conflicts:"
  echo "      Wyze app → Camera → Settings → Detection Settings → Motion Tracking → Off"
  echo ""
  echo "    To set a 'home' position (where the camera returns after tracking):"
  echo "      Frigate UI → PTZ → move camera to desired position → Save as preset 'home'"
  echo ""
fi
echo -e "  ${CYAN}Next steps${NC}"
echo "    1. Open Frigate → draw zones around your driveway/porch"
echo "       (this limits alerts to areas you care about)"
echo "    2. Open http://${TS_IP}:3000 → Train → add face photos"
echo "       for you and your wife"
if [[ -z "$KNOWN_PEOPLE" ]]; then
  echo "    3. Edit .env → set KNOWN_PEOPLE=yourname,wifename"
  echo "       then run: docker compose up -d notifier"
fi
echo "    4. Set up Apple HomeKit: https://${TS_IP}:10443"
echo "       → Frigate NVR plugin → HomeKit plugin → scan QR code"
echo ""
echo -e "  ${CYAN}Useful commands${NC}"
echo "    View logs:        docker compose logs -f"
echo "    Restart:          docker compose restart"
echo "    Stop everything:  docker compose down"
echo "    Re-run wizard:    bash setup.sh"
echo ""
divider
echo ""
