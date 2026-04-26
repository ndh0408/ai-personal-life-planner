#!/usr/bin/env bash
# Connect huy-server ↔ Android phone over Tailscale and (optionally) start
# Expo on the right host so the phone can fetch the JS bundle.
#
# Usage:
#   scripts/connect-android.sh                       # interactive: prompts for phone IP
#   scripts/connect-android.sh 100.x.y.z             # adb connect to that IP:5555
#   scripts/connect-android.sh 100.x.y.z 37123      # custom adb port (Android 11+ wireless)
#   scripts/connect-android.sh --pair 100.x.y.z 41234   # one-time pairing (Android 11+)
#   scripts/connect-android.sh --start 100.x.y.z    # also start Expo bound to Tailscale IP
#
# Env overrides:
#   LIFEOS_PHONE_TS_IP    default phone IP (skip prompt)
#   LIFEOS_ADB_PORT       default 5555
#   LIFEOS_SERVER_TS_IP   override auto-detected server Tailscale IP

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

# --- preflight ---------------------------------------------------------------

if ! command -v adb >/dev/null 2>&1; then
  red "✗ adb not installed on huy-server"
  cat <<'EOF'

Install on Debian/Ubuntu:
    sudo apt update && sudo apt install -y adb

Then re-run this script.
EOF
  exit 1
fi

if ! command -v tailscale >/dev/null 2>&1; then
  red "✗ tailscale CLI not found"
  exit 1
fi

SERVER_IP="${LIFEOS_SERVER_TS_IP:-$(tailscale ip -4 | head -1)}"
if [ -z "$SERVER_IP" ]; then
  red "✗ could not determine this machine's Tailscale IP"
  exit 1
fi

ADB_PORT="${LIFEOS_ADB_PORT:-5555}"

MODE="connect"
START_EXPO=0
PHONE_IP=""
PAIR_PORT=""

# --- arg parse ---------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --pair)
      MODE="pair"
      shift
      PHONE_IP="${1:-}"; shift || true
      PAIR_PORT="${1:-}"; shift || true
      ;;
    --start)
      START_EXPO=1
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      if [ -z "$PHONE_IP" ]; then
        PHONE_IP="$1"
      else
        ADB_PORT="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$PHONE_IP" ]; then
  PHONE_IP="${LIFEOS_PHONE_TS_IP:-}"
fi

if [ -z "$PHONE_IP" ]; then
  printf 'Phone Tailscale IP (e.g. 100.x.y.z): '
  read -r PHONE_IP
fi

if [ -z "$PHONE_IP" ]; then
  red "✗ no phone IP provided"
  exit 1
fi

# --- pair (Android 11+ first-time wireless debugging) ------------------------

if [ "$MODE" = "pair" ]; then
  if [ -z "$PAIR_PORT" ]; then
    red "✗ --pair needs <ip> <pair-port>; the port is shown on your phone's"
    red "  Wireless debugging → Pair device with pairing code screen"
    exit 1
  fi
  green "▸ pairing with $PHONE_IP:$PAIR_PORT (you'll be asked for the 6-digit code)"
  adb pair "$PHONE_IP:$PAIR_PORT"
  green "✓ paired. Now run without --pair to connect:"
  echo "    scripts/connect-android.sh $PHONE_IP <adb-port>"
  exit 0
fi

# --- connect ------------------------------------------------------------------

green "▸ this machine: $SERVER_IP   phone: $PHONE_IP:$ADB_PORT"
dim   "  (override server with LIFEOS_SERVER_TS_IP if needed)"

# kill-server reduces "device offline" loops after IP changes
adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null

if ! adb connect "$PHONE_IP:$ADB_PORT" | tee /dev/stderr | grep -qE '^connected'; then
  red "✗ adb connect failed"
  cat <<EOF

Common fixes:
  • Phone: Settings → Developer options → Wireless debugging is ON
  • Android 11+: first time needs pairing — run:
        scripts/connect-android.sh --pair $PHONE_IP <pair-port>
    where <pair-port> is shown on the "Pair device with pairing code" screen
  • Tailscale ACLs allow port $ADB_PORT between this node and the phone
  • Phone hasn't gone to sleep (screen off can drop wireless debugging)
EOF
  exit 1
fi

green "▸ adb devices:"
adb devices

# --- expo --------------------------------------------------------------------

cat <<EOF

Next:
  1. Make sure apps/mobile/.env has:
        EXPO_PUBLIC_API_BASE_URL=http://$SERVER_IP:4000/api
  2. Start API:
        npm run dev:api
  3. Start Expo bound to your Tailscale IP:
        REACT_NATIVE_PACKAGER_HOSTNAME=$SERVER_IP npm run dev:mobile -- --host lan
EOF

if [ "$START_EXPO" -eq 1 ]; then
  echo
  green "▸ starting Expo with REACT_NATIVE_PACKAGER_HOSTNAME=$SERVER_IP"
  cd "$ROOT"
  REACT_NATIVE_PACKAGER_HOSTNAME="$SERVER_IP" npm run dev:mobile -- --host lan
fi
