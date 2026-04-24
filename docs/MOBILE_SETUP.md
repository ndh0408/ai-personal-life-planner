# Mobile setup

`apps/mobile` is a React Native + Expo SDK 51 app written in TypeScript. It
talks to `apps/api` over HTTPS — never to AI providers directly.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Navigation | `@react-navigation/native` (native-stack + bottom-tabs) | Battle-tested on Android/iOS, easy modal/group composition. |
| Server state | `@tanstack/react-query` | Caching, refetch, retries, dedupe. |
| Local state | `zustand` | Minimal boilerplate; auth state lives here. |
| Forms | `react-hook-form` + `zod` (`@hookform/resolvers/zod`) | Type-safe, reuses our shared Zod schemas. |
| Tokens | `expo-secure-store` (Keychain / Keystore) | Encrypted at rest. AsyncStorage fallback on web. |
| Cache | `@react-native-async-storage/async-storage` | Non-sensitive JSON cache. |
| Notifications | `expo-notifications` | Permission flow + Android channel set up at boot. |
| Theme | Light/dark from system via `useColorScheme` | No third-party theme lib needed. |

## Folder layout

```
src/
├── navigation/        Root + Auth + Onboarding stacks, Main tabs
├── screens/
│   ├── auth/          Login, Register
│   ├── onboarding/    Welcome → Profile → Goal → Schedule
│   ├── today/         TodayScreen, ScheduleDetail, SleepMoodCheckin
│   ├── tasks/         TasksScreen, CreateTaskScreen
│   ├── habits/        HabitsScreen, CreateHabitScreen
│   ├── meals/         MealsScreen
│   ├── ai/            AIChatScreen
│   ├── profile/       ProfileScreen
│   ├── reports/       WeeklyReportScreen
│   └── settings/      SettingsScreen
├── components/
│   ├── ui/            Button, Input, Card, Badge, Chip, Empty/Loading/Error/Skeleton, Screen
│   └── planner/       TimelineItem
├── services/
│   ├── api/           client (with refresh interceptor) + per-domain modules
│   ├── auth/          token-store
│   ├── storage/       secure-storage (Keychain on native, AsyncStorage on web)
│   └── notifications/ permission + channel setup
├── store/             Zustand auth store (status / user / login / logout / hydrate)
├── hooks/
├── types/             re-exports @planner/shared + ApiEnvelope helpers
├── utils/             format helpers
├── constants/         storage + query keys
├── config/            env reader (EXPO_PUBLIC_*)
└── theme/             colors + spacing + typography + ThemeProvider
```

## Setup

```bash
# From the repo root
npm install                                       # installs all workspaces

# Make sure the backend is up and reachable
npm run dev:db                                    # docker postgres
npm run dev:api                                   # NestJS on :3000

# Env file for the mobile app
cp apps/mobile/.env.example apps/mobile/.env
# Edit EXPO_PUBLIC_API_BASE_URL if you are on a physical device

# Start the dev server
npm run dev:mobile                                # alias for `expo start`
```

Then press `a` for Android emulator, `i` for iOS simulator (macOS), or scan
the QR with Expo Go.

### Demo credentials

After `npm run db:seed`:

```
demo@planner.local
demo1234
```

## Auth flow

1. App boots → `RootNavigator` renders `<Splash />` while `useAuthStore.hydrate()` checks SecureStore for a token and calls `/users/me`.
2. No token / 401 → app stays on the **Auth stack** (Login / Register).
3. On login or register, tokens land in SecureStore and `status` flips to `authenticated` → app reaches the **Main tabs**.
4. Any 401 from the API client triggers `tokenStore.clear()` and `useAuthStore.setState({status:'unauthenticated'})` so the user lands back on Login automatically.
5. The API client serializes refresh attempts (single in-flight promise) and retries the original request once with the new access token before falling back to logout.

## API client

`src/services/api/client.ts` exposes `api.get/post/put/patch/delete<T>(path, …)`. All calls automatically:

- Prepend `EXPO_PUBLIC_API_BASE_URL`.
- Attach `Authorization: Bearer <accessToken>` when `auth !== false` (default true).
- Unwrap the `{ success, data, message }` envelope and return `data` typed as `T`.
- Convert HTTP errors into a typed `ApiError(status, message, body)` so screens can react with `Alert.alert(e.message)` consistently.
- Refresh tokens transparently on 401, then retry once.

Per-domain typed helpers live next to the client: `auth.api.ts`, `profile.api.ts`, `tasks.api.ts`, `schedules.api.ts`, `habits.api.ts`, `meals.api.ts`, `sleep-mood.api.ts`, `ai.api.ts`.

## State

- **Auth** lives in Zustand. Components read with `useAuthStore(s => s.user)`.
- **Server data** lives in TanStack Query under stable `QUERY_KEYS` from
  `src/constants/index.ts`. Use `useQuery` for reads, `useMutation` for writes
  and `queryClient.invalidateQueries({ queryKey: [...] })` to refetch.

## Theme & dark mode

`useColorScheme()` decides light vs dark; `theme/colors.ts` exports both
palettes. Components read via `useTheme()` and never hard-code colors. Status
bar uses `style="auto"` so it adapts.

## Notifications

`configureNotifications()` runs once at app boot and:
- Sets a foreground notification handler.
- On Android, creates the `default` channel.

Push permission is **not** requested at boot — `requestPushPermission()` is
called from `Settings → Enable push notifications` so the user opts in
explicitly. When you wire the upload-token flow to `/notification-devices`,
call `Notifications.getExpoPushTokenAsync()` after the permission grant.

## Building

```bash
# From apps/mobile/
npm i -g eas-cli && eas login
eas build --platform android --profile preview        # internal APK
eas build --platform android --profile production     # AAB (Play Store)
eas build --platform ios     --profile production     # IPA (App Store)
```

`eas.json` ships with `development`, `preview`, and `production` profiles.

## Common pitfalls

- **Phone can't reach `localhost`.** Set `EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-ip>:3000/api`. On Windows, `ipconfig` shows the IPv4. On macOS/Linux, `ifconfig | grep inet`.
- **Android emulator** maps `localhost` to the emulator itself, not the host. Use `http://10.0.2.2:3000/api`.
- **SecureStore on web**: SecureStore isn't supported on Web. We fall back to AsyncStorage there — fine for development, but don't ship a web build with sensitive data.
- **Reanimated babel plugin**: Expo SDK 51 includes the plugin in the default preset. If you customize `babel.config.js`, keep `babel-preset-expo` and put `'react-native-reanimated/plugin'` LAST.
