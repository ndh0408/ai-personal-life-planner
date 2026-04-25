# Deploy Mobile — Production (LifeOS AI)

End-to-end recipe for shipping the mobile app pointing at the live API
`https://api.tothanhthuy.cloud` (Cloudflare Tunnel → localhost:3000).

**Three delivery paths**, ordered by setup cost:

| Path | Output | Setup time | Apple acct? | Best for |
|---|---|---|---|---|
| **1. Expo Go tunnel** | QR code → app loads in Expo Go | 30 s | No | Immediate testing on a real phone |
| **2. EAS Build → APK** | Signed `.apk` to side-load | ~15 min | No | Real installable Android build |
| **3. EAS Build → AAB / IPA** | Play Store / TestFlight | ~30 min | iOS only | Public distribution |

All three use the **same** `app.config.ts`, `eas.json`, and assets that are
already committed. Only the active `EXPO_PUBLIC_APP_ENV` and the choice of
EAS profile changes what ships.

---

## Pre-flight (any path)

```bash
# 1. API is alive
curl -fsS https://api.tothanhthuy.cloud/api/health
# {"success":true,"data":{"status":"ok",...}}

# 2. Repo is up to date
git pull --ff-only

# 3. Deps installed
npm ci                                    # at repo root (workspaces)

# 4. Doctor — confirms Node, EAS CLI, env, API reachable
bash scripts/mobile-deploy.sh doctor
```

If `doctor` says **"Not logged in"** for EAS, do this once per build box:

```bash
cd apps/mobile
npx eas login                             # opens browser / prompts for token
npx eas init                              # links the Expo project (one-time)
```

`eas init` writes a `projectId` into `app.config.ts` `extra.eas.projectId`.
Commit that change so future builds reuse the same Expo project.

---

## Path 1 — Expo Go tunnel (fastest)

No build, no signing, no account. Use this to verify the app talks to the
production API end-to-end before committing to a real build.

```bash
bash scripts/mobile-deploy.sh tunnel
```

- Opens Metro with `--tunnel` (works through NAT / Cloudflare / mobile data).
- Install **Expo Go** on the phone (App Store / Play Store).
- Scan the QR — app boots in ~10 s, hits `https://api.tothanhthuy.cloud/api`.

**Caveats vs a real build**:
- Push notifications use Expo's push service, not native FCM/APNS.
- App icon / splash come from Expo Go, not your assets.
- Code is loaded from Metro — closing Expo Go ends the session.

Everything else (auth, dashboard, finance, AI chat, offline queue, i18n) works
exactly like a production build because the JS bundle is identical.

---

## Path 2 — EAS Build → APK (real installable Android)

Produces a signed `.apk` you can `adb install` and keep on the phone forever.
Uses the `preview` profile in [eas.json](../apps/mobile/eas.json) which sets
`EXPO_PUBLIC_APP_ENV=production` and `buildType: apk`.

```bash
bash scripts/mobile-deploy.sh verify          # double-check prod config resolves
bash scripts/mobile-deploy.sh android-apk     # ~10–15 min in EAS cloud
```

The script blocks until the build finishes and prints the download URL.
Re-fetch later with:

```bash
cd apps/mobile && npx eas build:list --platform android --limit 5
```

Install on a connected device:

```bash
adb install ~/Downloads/lifeos-ai-<sha>.apk
```

…or download the `.apk` URL directly on the phone and tap it (allow
"Install from unknown sources" the first time).

**First build prompts**: "Generate a new Android Keystore? [Y/n]" — say **yes**.
EAS stores it in your Expo account; back it up with
`npx eas credentials --platform android`. Losing the keystore means you can
never update the same Play Store listing.

---

## Path 3 — Play Store AAB + TestFlight IPA

### Android (AAB)

```bash
bash scripts/mobile-deploy.sh android-aab     # production profile
bash scripts/mobile-deploy.sh submit-android  # uploads to Play Console
```

`submit-android` will prompt for the Play Console service-account JSON the
first time — paste it once, EAS caches it.

### iOS (IPA → TestFlight)

Requires an Apple Developer account ($99/yr). EAS handles provisioning
profile + distribution certificate for you.

```bash
bash scripts/mobile-deploy.sh ios-ipa         # production profile, ~20 min
bash scripts/mobile-deploy.sh submit-ios      # uploads to App Store Connect
```

TestFlight takes ~15 min after upload to surface in the testers' app.

For local Simulator testing only (no Apple acct, but needs a Mac to actually
boot the Simulator):

```bash
bash scripts/mobile-deploy.sh ios-simulator
# Output is a .tar.gz — drag onto a running Simulator window or:
xcrun simctl install booted ~/Downloads/lifeos-ai-sim-<sha>.app
```

---

## Build matrix → what ends up in the bundle

Resolved at build time by [app.config.ts](../apps/mobile/app.config.ts):

| EAS profile | `EXPO_PUBLIC_APP_ENV` | App name | Bundle id | API URL source |
|---|---|---|---|---|
| `development` | `development` | `LifeOS AI Dev` | `…lifeosai.dev` | `apps/mobile/.env` |
| `staging` | `staging` | `LifeOS AI Staging` | `…lifeosai.staging` | `apps/mobile/.env.staging` |
| `preview` | `production` | `LifeOS AI` | `…lifeosai` | `apps/mobile/.env.production` |
| `production` (AAB/IPA) | `production` | `LifeOS AI` | `…lifeosai` | `apps/mobile/.env.production` |

**Production guards** (enforced in `app.config.ts`):
- `EXPO_PUBLIC_API_BASE_URL` is required.
- Must be `https://…`.
- Must not contain `localhost`, `127.0.0.1`, or `10.0.2.2`.

`bash scripts/mobile-deploy.sh verify` runs both guards before every build.

---

## Where the API URL is configured

Cloudflare Tunnel routes `api.tothanhthuy.cloud` → `localhost:3000` on this
host. The mobile app talks to `https://api.tothanhthuy.cloud/api`.

| File | Purpose |
|---|---|
| `apps/mobile/.env` | Active dev env (also picked up by Expo Go tunnel) |
| `apps/mobile/.env.staging` | Staging EAS profile |
| `apps/mobile/.env.production` | Production / preview EAS profiles |
| `apps/mobile/eas.json` | `env` block per profile (overrides `.env.*` when EAS Build runs in the cloud) |

To rotate the tunnel hostname:
1. Update `apps/mobile/.env`, `.env.staging`, `.env.production`.
2. `bash scripts/mobile-deploy.sh verify`.
3. Rebuild.

The active Cloudflare Tunnel has no reload — restart with
`sudo systemctl restart cloudflared` after changing `config.yml`.

---

## Common issues

**`eas: command not found`**
→ Always invoke via `npx eas …` from `apps/mobile/` or use the
`mobile-deploy.sh` wrapper. We deliberately keep it as a devDep instead of a
global install.

**Build fails with `EXPO_PUBLIC_API_BASE_URL is required`**
→ The active EAS profile has an empty `env` block AND no `.env.production`
exists in the build context. Fix: set the URL in `eas.json` or run
`npx eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://api.tothanhthuy.cloud/api`.

**Phone can't reach the API on the installed APK**
→ Confirm the bundled URL: `npx eas build:view <build-id>` and check the
`env` it ran with. Run `adb logcat | grep -i 'fetch\\|network'` while the app
is foregrounded.

**Tunnel command errors with `ngrok` not found on first run**
→ Expo will install `@expo/ngrok` automatically; accept the prompt or run
`npm i -D @expo/ngrok` once.

**App stuck on splash on a real device**
→ Usually a native config drift. Run `bash scripts/mobile-deploy.sh prebuild`
to regenerate `android/` + `ios/`, then rebuild.

**Want to bump the version**
1. Edit `apps/mobile/app.config.ts` → `version: '1.0.1'`.
2. Commit.
3. `bash scripts/mobile-deploy.sh android-aab` — `versionCode` /
   `buildNumber` auto-bump because `eas.json` sets `autoIncrement` for the
   `production` profile.

---

## SSH-in build-box checklist

When SSH-ing into a fresh box to run a build:

```bash
# Once per box
node -v   # ≥ 18, prefer 20
git clone <repo> AppQuanLY && cd AppQuanLY
npm ci
cd apps/mobile && npx eas login && npx eas init && cd ../..

# Each build
git pull --ff-only
bash scripts/mobile-deploy.sh doctor
bash scripts/mobile-deploy.sh verify
bash scripts/mobile-deploy.sh android-apk     # or android-aab / ios-ipa
```

Build runs in EAS cloud — the box only needs network + an authenticated EAS
session, not Android SDK / Xcode. Total local install footprint: Node +
this repo's `node_modules`.
