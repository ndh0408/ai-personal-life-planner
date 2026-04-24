# Mobile setup

`apps/mobile` is a React Native + Expo SDK 51 app written in TypeScript. It
talks to `apps/api` over HTTPS — never to AI providers directly.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Navigation | `@react-navigation/native` (native-stack + bottom-tabs) | Battle-tested on Android/iOS, easy modal/group composition. |
| Server state | `@tanstack/react-query` | Caching, refetch, retries, dedupe. |
| Local state | `zustand` | Minimal boilerplate; auth state lives here. |
| Forms | `react-hook-form` + `zod` (`@hookform/resolvers/zod`) | Type-safe, reuses shared Zod schemas. |
| i18n | `i18next` + `react-i18next` + `expo-localization` | vi/en at boot, device-detect + user-pick persistence in AsyncStorage. |
| Tokens | `expo-secure-store` | Encrypted at rest on Keychain/Keystore. |
| Cache | `@react-native-async-storage/async-storage` | Non-sensitive JSON cache. |
| Notifications | `expo-notifications` | Permission flow + Android channel set up at boot. |
| Theme | Light/dark from system via `useColorScheme` | No third-party theme lib needed. |

## Folder layout

```
src/
├── navigation/        Root + Auth + Onboarding stacks, Main tabs
├── screens/
│   ├── auth/
│   ├── onboarding/
│   ├── dashboard/       DashboardScreen (home tab)
│   ├── today/           TodayScreen, ScheduleDetail, SleepMoodCheckin
│   ├── tasks/           TasksScreen, CreateTaskScreen
│   ├── habits/          HabitsScreen, CreateHabitScreen
│   ├── meals/           MealsScreen
│   ├── health/          HealthScreen
│   ├── finance/         FinanceScreen, Wallets, Income, Expense, Budget,
│   │                    Debt, SavingGoals
│   ├── goals/           PersonalGoalsScreen
│   ├── assistant/       AssistantScreen (proactive recs + patterns)
│   ├── ai/              AIChatScreen
│   ├── reports/         WeeklyReport, DailyReview, MonthlyFinanceReport
│   ├── profile/
│   └── settings/        Settings + LanguageSettings
├── components/
│   ├── ui/              Button, Input, Card, Badge, Chip, Empty/Loading/
│   │                    Error/Skeleton, Screen, MoneyCard, ProgressCard,
│   │                    InsightCard, RecommendationCard
│   └── planner/         TimelineItem
├── services/
│   ├── api/             client (with refresh interceptor) + per-domain modules
│   │                    (auth, profile, tasks, schedules, habits, meals,
│   │                     sleep-mood, ai, finance, goals, health, assistant)
│   ├── auth/            token-store
│   ├── storage/         secure-storage (Keychain on native)
│   └── notifications/   permission + channel setup
├── store/               Zustand auth store
├── hooks/
├── types/               re-exports @planner/shared + ApiEnvelope helpers
├── utils/               format.ts (locale-aware date/time/money helpers)
├── constants/           storage + query keys
├── config/              env reader (EXPO_PUBLIC_*)
├── i18n/
│   ├── index.ts         bootstrap + setLocale + detectDeviceLocale
│   ├── useErrorMessage  hook mapping backend errorCode → localized message
│   └── locales/
│       ├── vi.json
│       └── en.json
└── theme/               colors + spacing + typography + ThemeProvider
```

## Navigation

**Bottom tabs (5):** Dashboard · Today · Finance · Assistant · Profile.
Task/Habit/Meal/Health lists and every finance subdomain (Wallets, Income,
Expense, Budget, Debt, SavingGoals) live in the root stack so they're pushed
from cards rather than cluttering the bottom bar.

Modal group:
CreateTask, CreateHabit, ScheduleDetail, SleepMoodCheckin, WeeklyReport,
Settings, LanguageSettings, AIChat.

## Setup

```bash
# From the repo root
npm install                                       # installs all workspaces

# Start the backend
npm run dev:db                                    # docker postgres on :5440
npm run dev:api                                   # NestJS on :3000

# Mobile env
cp apps/mobile/.env.example apps/mobile/.env
# Edit EXPO_PUBLIC_API_BASE_URL if you are on a physical device

npm run dev:mobile
```

Demo credentials after `npm run db:seed`:
```
demo@planner.local
demo1234
```

## Auth flow

1. `RootNavigator` renders `<Splash />` while `useAuthStore.hydrate()` checks SecureStore and calls `/me`.
2. No token / 401 → Auth stack (Login / Register).
3. On login/register, tokens land in SecureStore → status flips to `authenticated` → Main tabs.
4. Any 401 triggers `tokenStore.clear()` and resets to `unauthenticated`.
5. The API client serializes refresh attempts and retries the original call once.

## API client + typed domain modules

`src/services/api/client.ts` exposes `api.get/post/put/patch/delete<T>(path, …)`. All calls:

- Prepend `EXPO_PUBLIC_API_BASE_URL`.
- Attach `Authorization: Bearer <accessToken>` when `auth !== false`.
- Attach `Accept-Language: <activeLocale>` so the backend produces localized errors.
- Unwrap `{ success, data, message, errorCode }` and return `data` typed as `T`.
- Convert HTTP errors into `ApiError(status, message, body)`; body carries the stable `errorCode`.
- Refresh tokens transparently on 401 and retry once.

Domain modules (all typed):
`auth.api.ts`, `profile.api.ts`, `tasks.api.ts`, `schedules.api.ts`, `habits.api.ts`, `meals.api.ts`, `sleep-mood.api.ts`, `ai.api.ts` (includes `analyzeFinance` + `dailyReview`), `finance.api.ts` (wallets/incomes/expenses/budgets/debts/saving-goals), `goals.api.ts` (personal goals + milestones), `health.api.ts` (health-metrics + meal-logs), `assistant.api.ts` (today snapshot + recommendations + run-daily-monitoring).

## i18n

- Default locale: **vi** (Vietnamese).
- Supported: `vi`, `en`.
- Precedence at boot: AsyncStorage pick → device locale → `vi`.
- Mobile sends `Accept-Language: <activeLocale>` on every request; backend resolves via `LocaleService` and returns localized copy + stable `errorCode`.
- Change language: Settings → Language → select. Persists and hot-swaps.
- Locale-aware helpers in `src/utils/format.ts`: `formatDateByLocale`, `formatTimeByLocale`, `formatMoneyByLocale`, `formatMoneyCompact`, `getCurrentLocale`.
- Error copy: `useErrorMessage()` maps `errorCode` → `errors.<CODE>` key.

## Reusable UI

| Component | Purpose |
| --- | --- |
| `Button` / `Input` / `Card` / `Badge` / `Chip` | Primitives. |
| `EmptyState` / `Loading` / `ErrorView` / `Skeleton` | Never render a blank screen on failure. |
| `Screen` | Scrollable container with SafeArea + theme bg. |
| `MoneyCard` | Labeled currency figure + tone (positive/warning/danger). |
| `ProgressCard` | Linear bar for budgets / saving goals / personal goals. |
| `InsightCard` | 0..100 metric + UP/FLAT/DOWN trend glyph. Null safe (renders `—`). |
| `RecommendationCard` | Assistant nudge with type + priority badges and dismiss/apply actions. |

## State

- **Auth** in Zustand (`src/store/auth.store.ts`).
- **Server state** in TanStack Query. Stable query keys under `src/constants/index.ts`. Invalidate granularly on mutations.

## Notifications

`configureNotifications()` at app boot. Permission is opt-in from Settings, not on boot. Push token upload wires to `/notifications/devices` after grant.

## Building

```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas build --platform android --profile preview        # internal APK
eas build --platform android --profile production     # AAB (Play Store)
eas build --platform ios     --profile production     # IPA (App Store)
```

## Common pitfalls

- **Phone can't reach `localhost`** — set `EXPO_PUBLIC_API_BASE_URL=http://<LAN-ip>:3000/api`.
- **Android emulator** — use `http://10.0.2.2:3000/api`.
- **SecureStore on web** — falls back to AsyncStorage; never ship a web build with real user data.
- **Reanimated babel plugin** — keep `react-native-reanimated/plugin` last in `babel.config.js`.
