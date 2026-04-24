# Architecture — AI Personal Life Planner

## 1. Goals

A mobile-first personal planner that combines a structured to-do/habit/schedule store with an AI layer that:

- generates a suggested daily plan (wake/sleep/work/meals/breaks),
- adjusts the rest of the day when the user runs late,
- writes a weekly report,
- holds a personal chat conversation with full schedule context,
- and reminds the user via push notifications.

## 2. High-level diagram

```
┌────────────────┐      HTTPS / JWT       ┌──────────────────────┐
│  Mobile (Expo) │ ─────────────────────▶ │   API (NestJS)       │
│  React Native  │ ◀───────────────────── │  - Auth / Users      │
│  - UI          │                        │  - Tasks / Habits    │
│  - Offline     │                        │  - Schedule / Plan   │
│  - Push        │                        │  - AI proxy          │
└────────────────┘                        │  - Reports / Push    │
        │                                 └──────────┬───────────┘
        │ (only public expo config)                  │
        ▼                                            ▼
   AsyncStorage                             ┌──────────────────┐
   (cached profile,                         │   PostgreSQL     │
    last plan, tokens)                      │   via Prisma     │
                                            └──────────────────┘
                                                     ▲
                                                     │ (server-side only)
                                            ┌──────────────────┐
                                            │  AI provider     │
                                            │  (Anthropic etc) │
                                            └──────────────────┘
```

Mobile **never** talks to the AI provider directly. The provider key lives only in the API's environment.

## 3. Monorepo

npm workspaces:

```
apps/api       → @planner/api      (NestJS backend)
apps/mobile    → @planner/mobile   (Expo app)
packages/shared→ @planner/shared   (types + Zod)
```

`@planner/shared` is consumed via the workspace symlink. It's the single source of truth for:

- domain types (`User`, `Task`, `Habit`, `ScheduleBlock`, `DailyPlan`, …),
- request/response schemas (Zod) used by both the API for validation and the mobile app for forms.

## 4. Backend (apps/api)

### Module map

```
src/
├── main.ts                       bootstrap (helmet, cors, validation, filters)
├── app.module.ts                 wires every module
├── config/env.validation.ts      Zod-based env validation at boot
├── common/
│   ├── pipes/zod-validation.pipe.ts
│   ├── filters/all-exceptions.filter.ts
│   └── decorators/current-user.decorator.ts
├── prisma/                       PrismaModule + PrismaService (global)
└── modules/
    ├── health/      GET /api/health, /api/health/ready
    ├── auth/        register / login / refresh / logout (JWT + refresh hash)
    ├── users/       GET /api/users/me
    └── ai/          POST /api/ai/chat (auth-guarded; provider behind env)
```

Modules planned for next iterations:

- `tasks`           — CRUD, status transitions, due/scheduled queries
- `habits`          — CRUD + log endpoint, streaks
- `schedule`        — schedule blocks per day, conflict detection
- `planner` (AI)    — generate / re-plan day, prompt templates
- `wellbeing`       — sleep / mood / energy logs
- `meals`           — meal suggestions
- `reports`         — weekly aggregations + AI write-up
- `notifications`   — Expo push tokens, scheduled reminders

### Auth flow

1. `POST /api/auth/register` or `/login` → returns `{ accessToken, refreshToken, expiresIn }`.
2. Mobile stores both in AsyncStorage; sends `Authorization: Bearer <accessToken>` on protected routes.
3. On 401, mobile calls `POST /api/auth/refresh { refreshToken }` to rotate. The previous refresh token is revoked atomically.
4. Refresh tokens are stored only as SHA-256 hashes (column `tokenHash`, unique). Plaintext lives only in the client.

### Prisma schema (foundation)

Entities in v0:

- `User`, `RefreshToken`
- `Task` (priority, status, dueAt, scheduledFor, estimatedMinutes)
- `Habit`, `HabitLog`
- `ScheduleBlock` (kind enum: task/meal/sleep/exercise/focus/break/custom)

Migration is created on first `db:migrate` call. The schema is split per-feature only once the entity list grows.

## 5. Mobile (apps/mobile)

- Expo SDK 51, React Native 0.74.
- `metro.config.js` is configured for the workspace so it watches the monorepo root and resolves `@planner/shared` correctly.
- `src/services/api.ts` is the only place that talks to the API. It reads tokens from AsyncStorage and attaches the Bearer header. Auto-refresh on 401 is a planned enhancement.
- Offline strategy (planned): AsyncStorage cache of "today's plan", queue mutations for retry when reconnected.
- Push notifications: `expo-notifications` is in `package.json`; the registration → token-upload flow lives in the planned `notifications` slice.

### Building

- Dev: `expo start` (Expo Go or dev client).
- Android APK: `eas build --platform android --profile preview`.
- Android AAB (Play): `eas build --platform android --profile production`.
- iOS IPA: `eas build --platform ios --profile production`.

## 6. Shared package (packages/shared)

- Pure TypeScript, no React or Nest deps.
- Compiles to `dist/` via `tsc`. Both the API and the mobile app consume the source directly through workspace resolution; they don't need a pre-build for dev, but `npm run build` produces the `dist/` output if a consumer prefers it.
- Schemas use Zod so a single contract drives:
  - server-side request validation (`ZodValidationPipe`),
  - client-side form validation,
  - inferred TypeScript input types (`z.infer`).

## 7. Environment & secrets

| Where | What | Notes |
| --- | --- | --- |
| `.env` (root) | Values shared with `docker-compose` (Postgres user/pass/db) | Copy from `.env.example` |
| `apps/api/.env` | API runtime config: `DATABASE_URL`, JWT secrets, AI key, CORS, throttle | Validated by Zod on boot |
| `apps/mobile/.env` | `EXPO_PUBLIC_*` only — bundled into the app | **Never** put server secrets here |
| `docker/.env` | Picked up by docker compose | Optional |

The API throws on boot if any required env is missing or weak (e.g. a JWT secret shorter than 32 chars).

## 8. Local DB

`docker/docker-compose.yml` defines:

- `postgres` service (Postgres 16, healthchecked, named volume `planner_pgdata`)
- `pgadmin` service (in the `tools` profile — start with `docker compose --profile tools up`)

## 9. Quality gates

| Command | What |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run lint` | per-workspace lint (configured progressively) |
| `npm test` | per-workspace tests (Jest in API; placeholder in mobile/shared) |

CI hookup (planned): GitHub Actions matrix running `typecheck` + `test` for every PR.

## 10. Roadmap of business modules

1. **Tasks** — full CRUD, batch import, "what's next?" query.
2. **Schedule + planner (AI)** — `POST /planner/day` generates a plan; `POST /planner/replan` adjusts after a missed slot.
3. **Habits + wellbeing logs** — daily/weekly trackers, sleep/mood/energy entries.
4. **Meals** — AI suggestion endpoint based on profile constraints.
5. **Reports** — weekly aggregation + AI write-up via `POST /reports/week`.
6. **Notifications** — register Expo push tokens, server-scheduled reminders ahead of each block.
7. **Offline cache** — AsyncStorage-backed read-through cache for today's plan, with mutation queueing.

Each lands as its own NestJS module + a feature folder under `apps/mobile/src/`.
