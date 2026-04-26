#!/usr/bin/env bash
# One-shot: build debug APK, push it to the connected Android device over
# Tailscale ADB, and launch the app. Designed for tight test loops on
# huy-server → Xiaomi 13T (or any device adb-connected).
#
# Usage:
#   scripts/deploy-android.sh                 # debug build (default)
#   scripts/deploy-android.sh release         # release build (signed with debug key for now)
#   scripts/deploy-android.sh --no-launch     # build + install, do not launch
#
# Env:
#   LIFEOS_DEVICE        adb device id (default: first attached device)
#   ANDROID_HOME         path to Android SDK (default: $HOME/Android/sdk)
#
# Requires: adb on PATH, JDK on PATH, Android SDK installed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/mobile/android"
APPLICATION_ID="com.lifeos.ai"
LAUNCHER_ACTIVITY="${APPLICATION_ID}/${APPLICATION_ID}.MainActivity"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

# --- preflight ---------------------------------------------------------------

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

for bin in adb java; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    red "✗ $bin not on PATH"
    exit 1
  fi
done

if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
  red "✗ Android SDK platform 35 not installed at $ANDROID_HOME"
  exit 1
fi

# --- args --------------------------------------------------------------------

VARIANT="debug"
LAUNCH=1
for arg in "$@"; do
  case "$arg" in
    debug|release) VARIANT="$arg" ;;
    --no-launch)   LAUNCH=0 ;;
    -h|--help)     grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) red "✗ unknown arg: $arg"; exit 1 ;;
  esac
done

# --- pick device -------------------------------------------------------------

DEVICE="${LIFEOS_DEVICE:-}"
if [ -z "$DEVICE" ]; then
  DEVICE=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
fi
if [ -z "$DEVICE" ]; then
  red "✗ no adb device. Connect one or set LIFEOS_DEVICE=<ip:port>"
  echo "  Hint: scripts/connect-android.sh 100.<phone-ip> <port>"
  exit 1
fi
green "▸ device: $DEVICE   variant: $VARIANT"

# --- build -------------------------------------------------------------------

cd "$APP_DIR"
if [ "$VARIANT" = "release" ]; then
  GRADLE_TASK="assembleRelease"
  APK_PATH="$APP_DIR/app/build/outputs/apk/release/app-release.apk"
else
  GRADLE_TASK="assembleDebug"
  APK_PATH="$APP_DIR/app/build/outputs/apk/debug/app-debug.apk"
fi

green "▸ ./gradlew $GRADLE_TASK"
START=$(date +%s)
./gradlew "$GRADLE_TASK"
echo "  build took $(( $(date +%s) - START ))s"

if [ ! -f "$APK_PATH" ]; then
  red "✗ APK not found at $APK_PATH"
  exit 1
fi
SIZE_MB=$(du -m "$APK_PATH" | cut -f1)
dim "  APK: $APK_PATH (${SIZE_MB}MB)"

# --- install ------------------------------------------------------------------

green "▸ adb -s $DEVICE install -r"
adb -s "$DEVICE" install -r "$APK_PATH"

# --- launch -------------------------------------------------------------------

if [ "$LAUNCH" -eq 1 ]; then
  green "▸ adb shell am start $LAUNCHER_ACTIVITY"
  adb -s "$DEVICE" shell am start -n "$LAUNCHER_ACTIVITY" >/dev/null
  green "✓ launched on device"
fi

echo
echo "Tail logs:"
echo "  adb -s $DEVICE logcat ReactNative:V ReactNativeJS:V *:S"
