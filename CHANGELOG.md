# Changelog

All notable changes to LifeOS AI are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-04-25

First production release. LifeOS AI is a 24/7 personal life-operating-system
mobile app backed by a NestJS API and PostgreSQL — covering daily planning,
finance, habits, health, goals, AI scheduling, and proactive recommendations.

### Added

- **Mobile app (Expo / React Native)** — full feature surface: Dashboard,
  Today planner, Tasks, Habits, Meals, Sleep / Mood / Health check-ins,
  Finance (wallets, expenses, incomes, budgets, debts, saving goals), Goals
  + milestones, Assistant recommendations, AI Chat, Daily / Weekly / Monthly
  reports, Onboarding, Profile, Settings, Language picker.
- **Backend API (NestJS + Prisma + PostgreSQL)** — 25+ resource modules,
  Zod-validated controllers, Prisma schema with 3 migrations covering the
  full v1.0 data model (users, profile, schedules + items, tasks, habits,
  meals + logs, sleep / mood / health, wallets, expenses, incomes, budgets,
  debts, saving goals, personal goals + milestones, AI conversations,
  notification settings + devices + logs, recommendations).
- **AI engine** — provider-agnostic interface (`mock`, `anthropic`,
  `openai`); prompt builders for schedule generation, reschedule, meal
  suggestion, weekly insight, daily review, finance analysis, chat;
  bilingual system prompts (`vi` / `en`); JSON-validation + repair pass;
  fallback to mock-shape output when the upstream model fails.
- **Proactive assistant** — daily-monitoring orchestrator, behaviour
  tracking, life-insight generator, recommendation engine with 24 h dedupe
  and quiet-hours enforcement; bilingual signal templates.
- **i18n** — `vi` (default) and `en` with 833 keys per bundle; runtime
  language switch + persistence (AsyncStorage); device-locale detection;
  fallback `en`; `Accept-Language` header propagated on every API request;
  user profile `locale` field; AI replies in user locale; notification
  templates bilingual.
- **Auth** — bcrypt(10) password hashing; JWT access + refresh tokens with
  refresh-token rotation, SHA-256-hashed at rest, single-use, revocable;
  `logoutAll` endpoint; per-route throttle (register 5/min, login 10/min,
  refresh 30/min per IP).
- **Mobile token storage** — `expo-secure-store` on iOS/Android (AsyncStorage
  on web only).
- **Offline mode** — cache for read flows; sync queue for `task:setStatus`,
  `habit:log`, `expense:create`; offline banner; AI gate disables AI
  buttons while offline.
- **Notifications** — settings (per reminder type), quiet hours, device
  registration, log table; HIGH-priority recommendations queue a
  `NotificationLog` row.
- **Dashboard summary** — score cards, today plan summary, recent activity.
- **Reports** — daily review, weekly insight, monthly finance, goal progress.
- **Production deployment** — `docker-compose.production.yml` with
  Postgres + Redis + API; multi-stage `apps/api/Dockerfile` with non-root
  user, tini, healthcheck; helper scripts (`deploy.sh`, `migrate.sh`,
  `backup-db.sh`, `restore-db.sh`, `check.sh`); `EAS` build profiles for
  Android (AAB) and iOS (autoIncrement build numbers).
- **Documentation** — full module + architecture docs under `docs/`,
  including `SECURITY_AUDIT_REPORT.md`, `TESTING_QA.md`,
  `RELEASE_CHECKLIST.md`, `PRODUCTION_RUNBOOK.md` for v1.0.0.

### Security (release-hardening pass, 2026-04-25)

- **CORS** — production now refuses to start with `CORS_ORIGIN='*'` or
  unset; `credentials: true` is only enabled when origins are concrete
  (closes the spec-prohibited "wildcard + credentials" combination).
- **Env validation** — Zod `superRefine` enforces, in production:
  `CORS_ORIGIN` ≠ `*`, `AI_API_KEY` set when `AI_PROVIDER ≠ mock`, and
  `JWT_ACCESS_SECRET ≠ JWT_REFRESH_SECRET`.
- **AI fallback logs** — standardised on `briefAiError(e)`; clips at the
  first JSON-like boundary and 200 chars to avoid leaking provider request
  fragments.
- **Assistant orchestrator** — added `@Throttle(12/min)` to
  `run-daily-monitoring`, `generate-daily-review`, `generate-weekly-review`
  to match `ai.controller.ts`.
- **Auth error codes** — `auth.service.ts` now throws explicit
  `{ message, errorCode }` for `AUTH_EMAIL_TAKEN`,
  `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_DISABLED`,
  `AUTH_INVALID_REFRESH_TOKEN` (decoupled from the substring fallback in
  `AllExceptionsFilter`).
- **Notifications removeDevice** — replaced ad-hoc
  `Object.assign(new Error, { status })` with real `ForbiddenException` /
  `NotFoundException` so `403` no longer falls through to `500`.

### Fixed

- **Login screen** — removed shipped demo credentials
  (`demo@planner.local` / `demo1234`); empty defaults; fully translated.
- **Register screen** — replaced hard-coded `Asia/Ho_Chi_Minh` with device
  timezone via `expo-localization.getCalendars()`; fully translated.
- **Settings screen** — push-permission denied path now offers an
  `Open Settings` action that deep-links into the OS settings; copy
  translated.
- **Profile screen** — fully translated; row labels, logout dialog, error
  messages all use `t(...)` and the shared `useErrorMessage()` hook.
- **`ScheduleDetail`, `ErrorView`, `AIChatScreen`** — small hard-coded
  strings replaced with translation keys (`schedule.*`, `aiChat.*`,
  `common.tryAgain`, `common.send`).
- **Production health check** — `docker-compose.production.yml` and
  `Dockerfile` now hit `/api/health/ready` (with DB `SELECT 1`) instead
  of `/api/health` (liveness only).
- **Env naming** — normalised on `CORS_ORIGIN` (singular) across
  `.env.production.example` and `docker-compose.production.yml` to
  match the code reader.

### Known gaps (documented, not blocking v1.0.0)

- Push notification dispatcher (server → device) is not yet implemented;
  only opt-in toggles are persisted.
- Mobile language change does not PUT `/api/profile/locale`.
- Mobile API client for `notifications/devices` is missing; permission
  flow exists end-to-end except for token sync.
- Mobile bundle id `com.yourname.lifeosai` is a placeholder — must be
  changed before App Store / Play Store submission.
- Offline sync queue covers `task:setStatus`, `habit:log`,
  `expense:create` only; other writes show online-required errors when
  offline.

### Build & test status at sign-off

- `npm run typecheck` — green on `@planner/shared`, `@lifeos/api`,
  `@lifeos/mobile`.
- `npm test` — 96 tests pass across 22 backend test suites.
- `npm run build` — clean.
- 0 Critical, 0 High security findings open.
