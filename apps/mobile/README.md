# @planner/mobile

React Native + Expo + TypeScript. Talks to `@planner/api` over HTTPS — never to AI providers directly.

## Run dev

From the repo root:
```bash
npm install
npm run dev:api      # in one terminal
npm run dev:mobile   # in another — opens Expo dev tools
```

Press `a` for Android emulator, `i` for iOS simulator (macOS only), or scan the QR with Expo Go.

## Build APK / AAB / iOS

```bash
# One-time
npm i -g eas-cli
eas login

# From apps/mobile/
eas build --platform android --profile preview     # internal APK
eas build --platform android --profile production  # AAB for Play Store
eas build --platform ios     --profile production  # IPA for App Store
```

For local-only Android APK without EAS, use `expo prebuild` and Android Studio.

## Asset placeholders

`assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png`, `assets/favicon.png` are
referenced by `app.json`. Add real assets before building — Expo will warn otherwise.
