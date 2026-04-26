# LifeOS AI — Mobile Foundation

The shape of `apps/mobile`: how it boots, how it routes, where state lives,
which library does what, and the rules that keep it consistent.

> Visual rules live in [MOBILE_DESIGN_SYSTEM.md](./MOBILE_DESIGN_SYSTEM.md).
> The current backend contract lives in [API_CONTRACT.md](./API_CONTRACT.md).

## Stack

| Concern | Choice | Why this and not the obvious alternative |
|---|---|---|
| Runtime | React Native 0.74 (bare) + Hermes | Direct APK control, no Expo lock-in. Expo planned for iOS in a later round. |
| Navigation | `@react-navigation/native` + native-stack + bottom-tabs | Explicit route table beats file-system routing (Expo Router) at this scale. |
| Server state | TanStack Query 5 | Caching, refetching, single-flight refresh — without us reinventing. |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) | Uncontrolled inputs (faster); same Zod schemas the backend uses. |
| Client state | Zustand | One store for the auth state machine; no provider boilerplate. |
| Secret storage | `react-native-keychain` (Android Keystore) | Hardware-backed; tokens never sit in AsyncStorage. |
| Cache storage | `@react-native-async-storage/async-storage` | Non-secret reads with a tiny in-memory mirror for first-render. |
| i18n | `i18next` + `react-i18next` + `react-native-localize` | Catalogs (vi/en) on disk; locale auto-detected on boot. |
| Animations | `react-native-reanimated` 3 | Worklet-driven; required by react-navigation 6+. |
| Gestures | `react-native-gesture-handler` | Required by navigation + bottom sheets. |

## Boot order

```
index.js
 ├── side-effect imports: react-native-gesture-handler
 │                        react-native-reanimated   ← worklet runtime
 └── AppRegistry.registerComponent('LifeOS', () => App)

App  (src/app/App.tsx)
 ├── GestureHandlerRootView
 │   └── SafeAreaProvider
 │       └── QueryClientProvider
 │           └── I18nextProvider
 │               └── ToastProvider
 │                   └── RootNavigator
 │                       (drives off useAuthStore.stage)
 └── useEffect → useAuthStore.bootstrap()
```

On `bootstrap`:
1. `apiClient.hydrate()` reads the access + refresh token from Keychain.
2. If tokens exist, `authService.me()` validates the access token (refreshes
   transparently if 401).
3. If `me` succeeds, `aiKeyService.status()` decides between `onboarding`
   (no key set up yet) and `ready` (key configured).
4. The `RootNavigator` switches on `stage` and renders the correct stack.

## Folder layout

```
src/
  app/                 App entry component (providers + bootstrap)
  navigation/          types + AuthStack + OnboardingStack + MainTabs + RootNavigator
  screens/
    auth/              LoginScreen, RegisterScreen
    onboarding/        WelcomeScreen, BasicSetupScreen, AISetupScreen
    main/              HomeScreen, TodayScreen, MoneyScreen, AssistantScreen,
                       SettingsScreen, AISettingsScreen
  components/
    ui/                The 18-component design system primitives
    home/              Home-specific composites (round 2+)
    quick-capture/     QuickCaptureBar etc. (round 2+)
    finance/           Wallet, Expense list, etc. (round 3+)
    today/             Daily plan composites (round 3+)
    assistant/         Chat composites (round 4+)
  services/
    api/               client.ts (fetch + envelope), config.ts, errors.ts,
                       queryClient.ts, *.service.ts (typed wrappers)
    auth/              auth.service.ts
    storage/           secure.ts (Keychain), cache.ts (AsyncStorage + mirror)
  store/               auth.store.ts (Zustand state machine)
  hooks/               useHealth, useAiKeyStatus, useDebounce
  theme/               colors, spacing, radius, typography, shadows, index
  i18n/                index.ts (i18next init), locales/{vi,en}.json
  utils/               error.ts (errorCode → i18n), format.ts (money, time)
```

## Navigation map

```
RootNavigator
 ├── stage = unauthenticated → AuthStack
 │                              ├── Login    ↔ Register
 ├── stage = onboarding       → OnboardingStack
 │                              ├── Welcome → BasicSetup → AISetup
 └── stage = ready            → MainStack
                                ├── MainTabs (Home / Today / Money / Assistant / Settings)
                                └── AISettings  (presented from Settings.aiKey row)
```

Stage transitions:

| From | Trigger | To |
|---|---|---|
| `booting` | `bootstrap` finishes — no tokens | `unauthenticated` |
| `booting` | `bootstrap` finishes — tokens valid, no AI key | `onboarding` |
| `booting` | `bootstrap` finishes — tokens valid, AI key set | `ready` |
| `unauthenticated` | `signIn` / `signUp` succeeds | `onboarding` (or `ready` if key already set) |
| `onboarding` | `markAiKeyConfigured(true)` (after setup-openai) | `ready` |
| `onboarding` | `finishOnboarding()` (skip) | `ready` |
| any | 401 from any API call | `unauthenticated` (`apiClient.tearDownSession`) |
| any | `signOut` | `unauthenticated` |

## API client rules

`src/services/api/client.ts` is the only place `fetch` is called. Every
screen and every TanStack Query hook goes through `apiClient.request`.

- Envelopes (`{ success, data, errorCode, message }`) are unwrapped — `data`
  is returned, errors throw `ApiHttpError(status, errorCode, message, requestId)`.
- 401 + recoverable code (`invalid_token` / `missing_token`) triggers a
  single-flight refresh. The original call is replayed once.
- 401 that survives the refresh fires `tearDownSession()` — the auth store
  listens and routes to `unauthenticated`.
- Network failures → `NetworkError` → mapped to `auth.errors.network` in i18n.

`process.env.LIFEOS_API_BASE_URL` is honoured at bundle time; fallback dev
URL is the Tailscale dev box (`http://100.100.210.85:4000/api`); production
hard-fails on a localhost-shaped URL.

## Forms

Every form is React Hook Form + a Zod schema; `mode: 'onChange'` so the
submit button stays disabled until valid. Errors surface via `fieldState.error`
on the matching field — translated string, never the raw Zod message.

```tsx
const Schema = z.object({ email: z.string().email(), password: z.string().min(8) });
const { control, handleSubmit, formState } = useForm({
  resolver: zodResolver(Schema),
  mode: 'onChange',
});
```

## i18n

- Catalogs are JSON, structurally identical between `vi.json` and `en.json`.
  Adding a key on one side without the other will surface the raw path on
  screen — the missing-key fallback is "render the dotted path" so it's
  obvious in dev.
- Detection on boot via `react-native-localize.findBestLanguageTag(['vi','en'])`.
- Runtime swap via `i18n.changeLanguage(...)` — the Settings screen exposes
  a vi/en toggle.

## Token lifecycle

| Token | TTL | Where it lives | Rotated when |
|---|---|---|---|
| Access JWT | 15 min | Keychain + RAM | Refresh succeeds |
| Refresh JWT | 30 days | Keychain only | Every refresh |

On any 401 with a recoverable code, the client refreshes once; on success,
it replays the original call; on failure (revoked / expired), it clears
both tokens, signals `tearDownSession`, and the store routes to login.

## What's not yet wired (parked for the next round)

- Quick Capture bar + parser → goes under `components/quick-capture/`,
  posts to `/capture/parse` and `/capture/confirm` (backend round 2).
- Per-tab data hooks: today's plan, weekly spend rollup, mood streak, etc.
- "Wipe local cache" in Settings → currently inert.
- Hidden Developer panel (7-tap on version row) for power users.
- Push notifications (`react-native-push-notification` or `notifee`).
- iOS via Expo (planned phase 2).

## Operating commands

```bash
# Install
npm install                        # workspace install hoists into root

# Run Metro (dev)
npm run dev:mobile                 # react-native start

# Build & install
npm run android:dev                # debug APK + install on attached device
npm run android:release            # release APK + install
npm run android:deploy             # one-shot wrapper (debug)
npm run android:deploy:release     # one-shot wrapper (release)
npm run android:connect            # adb connect over Tailscale
```

## Quality gates

- `npm run typecheck` — passes across api/mobile/shared.
- `npm run lint` — runs `eslint --max-warnings=0` in every workspace.
- `npm run test` — Jest in api/shared (mobile tests land in a later round).
