#!/usr/bin/env bash
# =============================================================================
# scripts/mobile-deploy.sh — one-shot mobile build/deploy from a build box
#
# Usage (run from repo root):
#   bash scripts/mobile-deploy.sh <target>
#
# Targets:
#   tunnel              Start Expo dev server with --tunnel (Expo Go on phone)
#   verify              Sanity-check production config resolves
#   prebuild            Regenerate android/ + ios/ from app.config.ts
#   android-apk         EAS build → installable APK (preview profile, prod env)
#   android-staging     EAS build → APK pointing at staging API
#   android-aab         EAS build → Play Store AAB (production profile)
#   ios-simulator       EAS build → .tar.gz for iOS Simulator
#   ios-ipa             EAS build → IPA for TestFlight (production profile)
#   submit-android      eas submit AAB to Play Store (needs creds)
#   submit-ios          eas submit IPA to TestFlight (needs creds)
#   doctor              Print versions, env, EAS auth status
#
# First-time setup on a fresh build box:
#   1. nvm install 20 && nvm use 20         # or any Node ≥ 18
#   2. npm ci                                # at repo root
#   3. cd apps/mobile && npx eas login       # interactive — opens browser
#   4. npx eas init                          # links Expo project (one-time)
#   5. bash scripts/mobile-deploy.sh android-apk
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
TARGET="${1:-help}"

cd "$MOBILE_DIR"

# Always run via local devDep so we don't depend on a global install.
EAS="npx --no-install eas"
EXPO="npx --no-install expo"

case "$TARGET" in
  tunnel)
    echo "==> Starting Expo Go tunnel (point your phone's Expo Go app at the QR)"
    echo "    API target: $(grep EXPO_PUBLIC_API_BASE_URL .env | cut -d= -f2-)"
    exec $EXPO start --tunnel --clear
    ;;

  verify)
    echo "==> Verifying production config resolves with HTTPS API URL"
    EXPO_PUBLIC_APP_ENV=production \
      EXPO_PUBLIC_API_BASE_URL=https://api.tothanhthuy.cloud/api \
      $EXPO config --type public > /dev/null
    echo "OK: production config resolves"

    echo "==> Verifying production guard rejects localhost"
    if EXPO_PUBLIC_APP_ENV=production \
         EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api \
         $EXPO config --type public >/dev/null 2>&1; then
      echo "FAIL: localhost was accepted in production"
      exit 1
    fi
    echo "OK: localhost rejected in production"
    ;;

  prebuild)
    echo "==> Regenerating android/ + ios/ from app.config.ts"
    $EXPO prebuild --clean --no-install
    ;;

  android-apk)
    echo "==> EAS build → installable APK (preview / production env)"
    $EAS build --platform android --profile preview --non-interactive --wait
    echo "==> Latest builds:"
    $EAS build:list --platform android --limit 3
    ;;

  android-staging)
    echo "==> EAS build → APK against staging API"
    $EAS build --platform android --profile staging --non-interactive --wait
    ;;

  android-aab)
    echo "==> EAS build → Play Store AAB"
    $EAS build --platform android --profile production --non-interactive --wait
    ;;

  ios-simulator)
    echo "==> EAS build → iOS Simulator .tar.gz"
    $EAS build --platform ios --profile ios-simulator --non-interactive --wait
    ;;

  ios-ipa)
    echo "==> EAS build → IPA for TestFlight"
    $EAS build --platform ios --profile production --non-interactive --wait
    ;;

  submit-android)
    echo "==> Submit latest AAB to Play Store"
    $EAS submit --platform android --profile production --latest
    ;;

  submit-ios)
    echo "==> Submit latest IPA to TestFlight"
    $EAS submit --platform ios --profile production --latest
    ;;

  doctor)
    echo "==> Node:           $(node -v)"
    echo "==> npm:            $(npm -v)"
    echo "==> Repo:           $REPO_ROOT"
    echo "==> Mobile cwd:     $MOBILE_DIR"
    echo "==> EAS CLI:        $($EAS --version 2>&1 | head -1)"
    echo "==> Expo CLI:       $($EXPO --version 2>&1 | head -1)"
    echo "==> Logged-in user: $($EAS whoami 2>&1 || echo 'not logged in — run: cd apps/mobile && npx eas login')"
    echo "==> .env API URL:   $(grep '^EXPO_PUBLIC_API_BASE_URL' .env 2>/dev/null | cut -d= -f2-)"
    echo "==> .env APP_ENV:   $(grep '^EXPO_PUBLIC_APP_ENV' .env 2>/dev/null | cut -d= -f2-)"
    echo "==> API health:"
    curl -sS -o /dev/null -w "    HTTP %{http_code}  time=%{time_total}s\n" \
      https://api.tothanhthuy.cloud/api/health || echo "    UNREACHABLE"
    ;;

  help|*)
    sed -n '1,30p' "$0"
    exit 1
    ;;
esac
