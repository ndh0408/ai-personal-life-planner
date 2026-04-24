# Build — Android (LifeOS AI)

End-to-end guide for producing an installable APK (internal) and a Play Store AAB. Expo-managed workflow, EAS Build for the native compilation.

## What ships to Android

| Item | Value |
| --- | --- |
| App name | `LifeOS AI` (Dev/Staging variants append `Dev` / `Staging`) |
| Package | `com.yourname.lifeosai` — variants append `.dev` / `.staging` so builds can coexist on one device |
| Version name | `1.0.0` (from `app.config.ts` → `version`) |
| Version code | `1` (`android.versionCode`); `eas.json` `production.autoIncrement: true` bumps it on every release build |
| Icon | `assets/icon.png` (1024×1024) |
| Adaptive icon | `assets/adaptive-icon.png` (foreground) + `backgroundColor: #0B0B0F` |
| Splash | `assets/splash.png`, centered, `resizeMode: contain`, `#0B0B0F` background |
| Permissions | `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `VIBRATE` |
| Plugins | `expo-notifications`, `expo-localization`, `expo-secure-store` |

Placeholder assets live in `apps/mobile/assets/*.png` — replace with designer artwork before store submission.

## Environments

Selected via `EXPO_PUBLIC_APP_ENV`. `app.config.ts` reads it at build time.

| Env | Variant suffix | Purpose |
| --- | --- | --- |
| `development` | `.dev` / `Dev` | Local Metro + dev server on your LAN |
| `staging` | `.staging` / `Staging` | Internal APK against staging API |
| `production` | none | Play Store AAB |

Hard rules (enforced by `app.config.ts` and `src/config/env.ts`):
- Production requires `EXPO_PUBLIC_API_BASE_URL` to be set.
- Must be `https://…`.
- Must not contain `localhost`, `127.0.0.1`, or `10.0.2.2`.
- No secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, etc.) exist in `apps/mobile/**`; the client only talks to `/api/ai/*` and the server holds all credentials.

## Install EAS CLI + log in

```bash
npm i -g eas-cli
eas login                      # opens browser / prompts for your Expo account
eas whoami                     # verify
cd apps/mobile
eas init                       # first time only — associates the project id
```

If `expo-cli` is installed globally, it coexists with EAS — you don't have to remove it.

## Environment files

Copy the examples and fill in the real URLs:

```bash
cp apps/mobile/.env.example          apps/mobile/.env.development
cp apps/mobile/.env.staging.example  apps/mobile/.env.staging
cp apps/mobile/.env.production.example apps/mobile/.env.production
```

Expo auto-loads `.env.<profile>` when the matching `eas build --profile <profile>` runs, but EAS Build is hermetic — the `env` block in `eas.json` is what actually ships into the build. For secrets / tokens that shouldn't live in a committed example, use `eas secret:create`.

## Build APK (internal install, side-load)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- Profile `preview` produces an `apk` via the production bundle (same `EXPO_PUBLIC_APP_ENV=production`, same signed package id).
- Use `staging` for an internal build that points at staging API:
  ```bash
  eas build --platform android --profile staging
  ```

When the build completes, EAS prints a download URL. You can also retrieve it later with:

```bash
eas build:list --platform android --limit 5
```

### Install the APK on a device

```bash
adb devices                                # confirm the device is connected
adb install ~/Downloads/lifeos-ai.apk
```

Or download + tap the APK directly on the device ("Install from unknown sources" permission required the first time).

## Build AAB (Play Store)

```bash
cd apps/mobile
eas build --platform android --profile production
```

- Profile `production` produces an `app-bundle` (`.aab`).
- `autoIncrement: true` bumps `android.versionCode` for you — commit the bump back via `eas build --platform android --auto-submit-with-profile=production` if you want EAS to handle the upload too.
- Submission step (one-time credentials setup):
  ```bash
  eas submit --platform android --profile production
  ```
  Follow the prompts to paste your Play Console service-account JSON.

## Signing

First production build will prompt:

> Generate a new Android Keystore?

Say **yes** unless you already have one; EAS stores the keystore in your Expo account (`eas credentials` to view). Losing it means you cannot update the Play Store listing, so back it up: `eas credentials` → download.

## Pre-flight test checklist

Run these on a real APK before shipping:

- [ ] App launches, splash shows, home screen renders.
- [ ] Settings → Language → **Vietnamese** → restart app → still VI (persists via AsyncStorage).
- [ ] Settings → Language → **English** → labels flip immediately across Dashboard / Today / Finance / Assistant / Reports.
- [ ] Register a new account → onboarding → dashboard populates.
- [ ] Log in with existing account.
- [ ] Dashboard: 8 sections render, AI Planner / Today's plan reachable.
- [ ] Finance tab: month overview numbers + currency format (VND uses `1.234.567 ₫`, USD uses `$12.34`).
- [ ] `+ Add expense` (online) → list updates, wallet balance drops.
- [ ] AI Chat → send a message → receive a reply in the current locale.
- [ ] AI: "Generate today" on Today tab succeeds.
- [ ] Turn on airplane mode → within ~45 s banner shows "Bạn đang offline…" / "You're offline…".
- [ ] While offline, tap `+ Add expense` → alert "Saved for later".
- [ ] Tap AI CTA while offline → alert "AI is offline — you need an internet connection".
- [ ] Turn airplane mode off → banner flips to "Syncing N pending actions…" → queued expense appears in the list.

## Common issues

**"EXPO_PUBLIC_API_BASE_URL is required for production builds"** at build time
→ Your `.env.production` is missing or the `env` block in `eas.json` is empty. Either put the URL in EAS secrets (`eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://...`) or commit it in `eas.json`.

**"must not point at localhost in production"**
→ `app.config.ts` refuses localhost in production. Either switch profiles or use a real HTTPS URL.

**"Network request failed" on the installed APK but fine in dev**
→ Most likely the APK is pointing at a host your phone can't reach. Confirm with `adb shell am start -W -a android.intent.action.VIEW -d "lifeos://debug"` (or inspect logs via `adb logcat | grep fetch`). Fix by rebuilding with the correct `EXPO_PUBLIC_API_BASE_URL`.

**App crashes on splash on a physical device**
→ Usually a native dependency added in JS without `expo prebuild`-style native config. Run `eas build --platform android --profile development` with the dev client to get a readable stack trace via `adb logcat`.

**"Expired Expo credentials"**
→ `eas logout && eas login`.

**Play Store rejects the AAB ("debuggable")**
→ Never use `--local --profile development` for store uploads. Use `production` profile.

## Version bump workflow

```bash
# 1. Update version name in app.config.ts
#    version: '1.0.1'
# 2. Commit
git commit -am "chore(mobile): bump to 1.0.1"
# 3. Build
cd apps/mobile && eas build --platform android --profile production
# 4. eas auto-bumps versionCode. Submit:
eas submit --platform android --latest
```

## Production API URL sanity check

A quick test that the bundle won't ship with a dev URL:

```bash
cd apps/mobile
EXPO_PUBLIC_APP_ENV=production \
  EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api \
  npx ts-node --transpile-only -e "require('./app.config.ts')"
# expected: Error: … must be HTTPS in production …
```

Run this in CI before `eas build` to catch misconfigurations early.
