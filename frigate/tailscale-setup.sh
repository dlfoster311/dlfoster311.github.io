#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Tailscale setup — run once on the machine hosting Frigate
#
#  What this does:
#    1. Installs Tailscale (free, no account needed to start)
#    2. Starts Tailscale and prints your private Tailscale IP
#    3. Shows you the URLs to use for all services
#
#  After running this:
#    - Install the Tailscale app on your iPhone and Android phone
#    - Sign in with the same Tailscale account
#    - You now have a private, encrypted VPN between your phones and this server
#    - No port forwarding, no public IP, no one else can reach your cameras
#
#  Supports: Ubuntu, Debian, Raspberry Pi OS, Fedora, Arch Linux, macOS
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo ""
echo "  Frigate + Tailscale secure access setup"
echo "  ─────────────────────────────────────────"
echo ""

# ── 1. Install Tailscale ──────────────────────────────────────────────────────

if command -v tailscale &>/dev/null; then
  echo "  [ok] Tailscale is already installed ($(tailscale version | head -1))"
else
  echo "  [..] Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
  echo "  [ok] Tailscale installed"
fi

# ── 2. Start Tailscale ────────────────────────────────────────────────────────

echo ""
echo "  [..] Starting Tailscale..."
echo ""
echo "  A browser window (or URL) will open for you to log in."
echo "  Tailscale is free for personal use — sign in with Google, GitHub, or email."
echo ""

sudo tailscale up --accept-routes

# ── 3. Get Tailscale IP ───────────────────────────────────────────────────────

TS_IP=$(tailscale ip -4 2>/dev/null || echo "")

if [[ -z "$TS_IP" ]]; then
  echo "  [!] Could not detect Tailscale IP. Run 'tailscale ip -4' after login."
  exit 0
fi

# ── 4. Print service URLs ─────────────────────────────────────────────────────

echo ""
echo "  ✓ Tailscale is running. Your private IP is: ${TS_IP}"
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │  Access from your phone (install Tailscale app first)   │"
echo "  ├─────────────────────────────────────────────────────────┤"
printf "  │  Frigate live view:   http://%-28s│\n" "${TS_IP}:5000"
printf "  │  Double-Take (faces): http://%-28s│\n" "${TS_IP}:3000"
printf "  │  ntfy notifications:  http://%-28s│\n" "${TS_IP}:8080"
printf "  │  Scrypted (HomeKit):  https://%-27s│\n" "${TS_IP}:10443"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Install Tailscale on iPhone:"
echo "     https://apps.apple.com/app/tailscale/id1470499037"
echo ""
echo "  2. Install Tailscale on Android:"
echo "     https://play.google.com/store/apps/details?id=com.tailscale.ipn"
echo ""
echo "  3. Sign in to Tailscale on both phones with the same account"
echo "     you used above. Your phones are now on the private network."
echo ""
echo "  4. Update docker-compose.yml:"
echo "     - Set NTFY_BASE_URL  to http://${TS_IP}:8080"
echo "     - Set FRIGATE_URL    to http://${TS_IP}:5000"
echo "       (so notification links open from your phone over Tailscale)"
echo ""
echo "  5. Apply the changes:"
echo "     docker compose up -d notifier ntfy"
echo ""
echo "  6. In the ntfy app on your phone:"
echo "     - Settings → Default server → http://${TS_IP}:8080"
echo "     - Subscribe to your NTFY_TOPIC from docker-compose.yml"
echo ""
echo "  Security note:"
echo "  Your cameras are NOT exposed to the public internet."
echo "  Port 5000 is only reachable on your local network and via Tailscale."
echo "  Never forward port 5000 through your router."
echo ""
