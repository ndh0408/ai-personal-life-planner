# @lifeos/mobile

Expo React Native app for LifeOS AI.

The app **never holds the OpenAI key in plaintext** and **never calls OpenAI directly**.
All model calls go through [`@lifeos/api`](../api/README.md), which decrypts the user's
key in-memory just for the request.

See:
- [docs/UX_PRINCIPLES.md](../../docs/UX_PRINCIPLES.md)
- [docs/MOBILE_DESIGN_SYSTEM.md](../../docs/MOBILE_DESIGN_SYSTEM.md)

## Local dev

```bash
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile      # expo start
```

Use the Expo Go app or an iOS/Android simulator to load it.

## Scripts

- `start` — expo start
- `android` / `ios` / `web` — platform-specific launchers
- `typecheck` — `tsc --noEmit`
