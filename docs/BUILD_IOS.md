# Build — iOS (LifeOS AI)

End-to-end guide for iOS Simulator dev builds, TestFlight, and optional local Mac builds. Expo-managed workflow, same `app.config.ts` / `eas.json` as the Android track.

## What ships to iOS

| Item | Value |
| --- | --- |
| App name | `LifeOS AI` (variants append `Dev` / `Staging`) |
| Bundle identifier | `com.yourname.lifeosai` (variants append `.dev` / `.staging`) |
| Version | `1.0.0` (from `app.config.ts` → `version`) |
| Build number | `1`; `eas.json` `production.ios.autoIncrement: "buildNumber"` bumps automatically |
| Icon | `assets/icon.png` (1024×1024) — iOS uses the square icon, no adaptive variant |
| Splash | `assets/splash.png`, `#0B0B0F` background |
| Localizations | `CFBundleLocalizations: ['vi', 'en']`, `CFBundleDevelopmentRegion: vi` |
| Permission strings | `NSUserNotificationsUsageDescription` — gentle reminders copy |

## Environments

Same three tiers as Android, selected with `EXPO_PUBLIC_APP_ENV`.

- **development** — Metro dev server on LAN; builds for iOS Simulator.
- **staging** — internal build pointing at staging API.
- **production** — TestFlight / App Store.

Same production guards as Android: `EXPO_PUBLIC_API_BASE_URL` required, HTTPS only, no `localhost`/`127.0.0.1`. `app.config.ts` throws at build time if any rule is broken.

No secrets in the mobile bundle — the iOS binary only talks to `/api/*` endpoints. AI keys live on the backend.

## Prerequisites

- An Expo account (`eas login`) — works from Linux/Mac/Windows.
- For TestFlight / App Store: an Apple Developer account ($99/yr). EAS handles the provisioning profiles + certificates when you run `eas credentials`.
- For local Mac builds only: macOS + Xcode 15+ + CocoaPods.

## Install EAS CLI

```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas init           # first time — writes the project id into app.config
```

## Environment files

```bash
cp apps/mobile/.env.example            apps/mobile/.env.development
cp apps/mobile/.env.staging.example    apps/mobile/.env.staging
cp apps/mobile/.env.production.example apps/mobile/.env.production
```

The `env` block in `eas.json` pins `EXPO_PUBLIC_APP_ENV` per profile. The API URL comes from the matching `.env.<profile>` or from `eas secret:create`.

## iOS Simulator dev build (quickest path, no Apple account needed)

```bash
cd apps/mobile
eas build --platform ios --profile ios-simulator
```

- Profile `ios-simulator` sets `ios.simulator: true` — produces a `.tar.gz` you can drag into a running Simulator or install with `xcrun simctl install booted lifeos.app`.
- Pairs well with `EXPO_PUBLIC_APP_ENV=staging` so the build hits your staging API.

Alternatively, for live reload dev:

```bash
# On the Mac running the Simulator:
cd apps/mobile
npm run ios              # opens Simulator + Metro
```

## TestFlight build (requires Apple Developer)

```bash
cd apps/mobile
eas build --platform ios --profile production
```

First run asks to create + store Apple credentials (app-specific password or App Store Connect API key). EAS handles provisioning profile + distribution certificate for you. The output is a `.ipa`.

Submit:

```bash
eas submit --platform ios --profile production --latest
```

Upload lands in App Store Connect → TestFlight within ~15 minutes. From there: add internal testers → they install via the TestFlight app.

## Local build on Mac (only if EAS isn't an option)

```bash
cd apps/mobile
npx expo prebuild --platform ios            # generates apps/mobile/ios/
cd ios
pod install
open LifeOSAI.xcworkspace
# In Xcode: select your team under Signing & Capabilities, pick a device,
# Product → Archive. Upload from Organizer.
```

Prefer EAS whenever you can — the `prebuild` output has to be re-generated on every native-dep change, and local signing is fragile.

## Pre-flight test checklist (iOS)

- [ ] App launches cleanly on iPhone 15 Simulator + a real device.
- [ ] Splash color matches `#0B0B0F`, icon visible on home screen.
- [ ] Language starts at **vi** (device default if not Vietnamese → falls back via i18n init).
- [ ] Settings → Language → **English** → labels flip immediately.
- [ ] Kill the app, reopen → language still English (AsyncStorage persistence).
- [ ] Dates render locale-aware:
  - vi: `Thứ hai, 25 thg 4, 2026`
  - en: `Mon, Apr 25, 2026`
- [ ] Times render 24h in vi / 12h in en (iOS region default).
- [ ] Money format: VND → `1.234.567 ₫` (vi-VN) / `₫1,234,567` (en-US); USD → `$12.34` / `12,34 US$`.
- [ ] Register + Login work.
- [ ] Dashboard numbers load.
- [ ] AI Chat responds in the selected locale.
- [ ] AI "Generate today" produces a schedule; allow notifications when prompted.
- [ ] Receive a notification by tapping a high-priority rec (Assistant tab).
- [ ] Offline: toggle Airplane Mode in Simulator (`Device → Features → Toggle Airplane Mode`) → banner appears → AI blocked → task/habit queued.

## Common issues

**"Unable to verify credentials"** during `eas build`
→ Log out of Apple on your machine + in Xcode; rerun `eas build`, let EAS regenerate credentials interactively.

**Build stuck at "Uploading" step**
→ Slow network. EAS retries; leave it running. For big bundles, `--non-interactive` + CI is faster.

**"Provisioning profile doesn't include the selected device"**
→ Only matters for ad-hoc builds. Re-run `eas credentials` and re-generate, or use TestFlight instead (no device list maintenance).

**Device clock wrong → weird date formatting**
→ Not a build issue, but the user's device language + region drive all locale-aware formatting.

**Icon looks blurry on iOS but fine on Android**
→ You replaced `icon.png` with a transparent PNG — iOS needs a fully opaque 1024×1024. Fill the background to match `#0B0B0F`.

## Production API URL sanity check

```bash
cd apps/mobile
EXPO_PUBLIC_APP_ENV=production \
  EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api \
  npx ts-node --transpile-only -e "require('./app.config.ts')"
# expected: Error: … must be HTTPS in production …
```

Wire this into CI so a stray localhost URL can never reach the App Store.

## Version bump workflow

```bash
# 1. Bump app.config.ts → version: '1.0.1'
# 2. Commit
git commit -am "chore(mobile): bump to 1.0.1"
# 3. Build — buildNumber auto-bumps
cd apps/mobile && eas build --platform ios --profile production
# 4. Submit
eas submit --platform ios --latest
```
