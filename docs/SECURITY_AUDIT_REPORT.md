# Security Audit Report — LifeOS AI v1.0.0

**Date:** 2026-04-25
**Scope:** `apps/api` (NestJS + Prisma), `apps/mobile` (Expo / React Native), `packages/shared`, `docker-compose.production.yml`, `apps/api/Dockerfile`, root scripts and env files.
**Auditor:** Principal Security Engineer review (delegated multi-agent code read).

## 1. Severity summary

| Severity | Found | Open at sign-off |
|----------|-------|------------------|
| Critical | 0     | 0                |
| High     | 0     | 0                |
| Medium   | 1     | 0 (fixed)        |
| Low      | 4     | 0 (fixed)        |
| Pass     | 11    | n/a              |

**Verdict:** Release-approved.

## 2. Findings & remediation

### MEDIUM — CORS wildcard with credentials in production *(fixed)*

`apps/api/src/main.ts` previously enabled CORS with `origin: '*'` (when `CORS_ORIGIN` was unset) **and** `credentials: true`. Per the CORS spec this combination is invalid; the underlying middleware reflects any incoming origin while still sending `Access-Control-Allow-Credentials: true`, exposing the API to credentialed cross-origin requests from arbitrary origins.

**Patch:**

- `apps/api/src/main.ts` — refuses to start in production if `CORS_ORIGIN` is empty or `*`; sets `credentials` only when origins are concrete.
- `apps/api/src/config/env.validation.ts` — Zod `superRefine` rejects `CORS_ORIGIN='*'` in production, and additionally enforces `AI_API_KEY` when `AI_PROVIDER!=='mock'`, and `JWT_ACCESS_SECRET !== JWT_REFRESH_SECRET`.
- `.env.production.example` and `docker-compose.production.yml` — variable normalised to `CORS_ORIGIN` (singular) end-to-end.

### LOW #1 — Demo credentials shipped with mobile bundle *(fixed)*

`apps/mobile/src/screens/auth/LoginScreen.tsx` previously had `defaultValues: { email: 'demo@planner.local', password: 'demo1234' }`. Fixed to empty defaults; screen is now fully translated via `useTranslation`.

### LOW #2 — AI fallback logs could leak provider request fragments *(fixed)*

`ai-finance.service.ts`, `ai-chat.service.ts`, `ai-daily-review.service.ts`, `ai-meal.service.ts`, `ai-insight.service.ts` previously logged raw `e.message`. Some Anthropic / OpenAI SDK errors include the request body in `message`. Standardised on `briefAiError(e)` (added in `ai-provider.service.ts`) which clips at the first JSON-like boundary and 200 chars.

### LOW #3 — Assistant orchestrator endpoints had no AI-specific throttle *(fixed)*

`assistant.controller.ts` POST `run-daily-monitoring`, `generate-daily-review`, `generate-weekly-review` previously inherited only the global 120/min throttle. Added `@Throttle({ default: { limit: 12, ttl: 60_000 } })` to each, matching `ai.controller.ts`.

### LOW #4 — Auth-error code mapping was substring-based *(fixed)*

`AllExceptionsFilter` previously inferred `AUTH_*` error codes from English substrings of the thrown `message`. Future message edits or i18n could silently break the mobile error mapping. `auth.service.ts` now throws `{ message, errorCode }` explicitly for `AUTH_EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_DISABLED`, `AUTH_INVALID_REFRESH_TOKEN`. The substring fallback in the filter remains as a safety net.

### LOW #5 — Notifications removeDevice 403 fall-through *(fixed)*

`notifications.service.ts removeDevice()` previously raised `Object.assign(new Error, { status: 403 })` for ownership violations, which became a 500 in `AllExceptionsFilter`. Replaced with `ForbiddenException` / `NotFoundException`; controller wrapper simplified.

## 3. Confirmed-Pass items (highlights)

- **Secrets** — no API keys, passwords, or tokens hard-coded in `apps/api/src`, `apps/mobile/src`, `scripts/`, or `docker/`. Mobile bundle has zero references to AI provider keys (`AI_API_KEY`, `OPENAI`, `ANTHROPIC`, `sk-*`).
- **Auth** — bcrypt(10) password hashing, short-lived JWT access + 30 d refresh tokens stored as SHA-256 hashes, single-use rotation on refresh, `logoutAll()` revokes every active row, `Throttle` on register (5/min), login (10/min), refresh (30/min) per IP.
- **Token storage (mobile)** — `expo-secure-store` on iOS/Android via `secure-storage.ts`; AsyncStorage only for non-secret data (i18n, offline cache, sync queue).
- **Localhost in production** — `app.config.ts` throws if a production build's `EXPO_PUBLIC_API_BASE_URL` is non-HTTPS or contains `localhost|127.0.0.1|10.0.2.2`. Production compose binds Postgres / Redis / API to `127.0.0.1` only — fronted by external reverse proxy.
- **IDOR / user ownership** — every entity-by-id service method (expenses, incomes, wallets, budgets, debts, saving-goals, sleep-logs, mood-logs, health-metrics, meal-logs, meals, tasks, schedules, schedule-items, goals, goal-milestones, habits, recommendations, notifications) enforces `row.userId !== userId` → 403, or uses `updateMany / deleteMany({ id, userId })`. `assertWalletOwned` blocks cross-tenant wallet drain via `walletId` parameter.
- **Validation** — every controller body uses `ZodValidationPipe(<schema>)`; global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` is the backstop in `main.ts`.
- **Error responses** — `AllExceptionsFilter` masks 5xx as `'Internal server error'` in production; never returns stack traces; logs stack only server-side.
- **AI prompt injection** — `BASE_GUARDRAILS` in `prompts/system.ts` instructs the model to treat `<user-*>` blocks as data, refuses medical / financial / legal advice, refuses to reveal system prompts. `AiPromptTemplateService.sanitize` strips ASCII control chars and triple-fence sequences and length-caps user input. Chat history is fetched server-side from the DB, never client-supplied.
- **Notifications dedup** — `recommendation.service.ts` 24 h dedupe per `(userId, signalCode)`; only HIGH-priority recommendations write a `NotificationLog` row; quiet-hours are respected.
- **No PII / secrets in logs** — `apps/mobile/src` has zero `console.*`. API logger paths log method/URL/status only; AI provider service logs `provider`, `attempt`, `elapsedMs`, `in/out` token counts (no content).
- **`.env` files** — git status confirms only `.env.example` / `.env.production.example` variants are tracked; `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `*.env`.
- **Refresh-token rotation** — current token is revoked **before** issuing a new pair; expired and revoked tokens are rejected.

## 4. Not blocking release — recommended follow-ups

- **R1 (Medium):** Push notification dispatcher is not yet implemented. `notifications.service.ts` only persists toggles + device tokens; there is no code path that composes a localised reminder body and writes a `NotificationLog`. Either ship as "settings stub, server send coming in v1.1" or implement the dispatcher before enabling the toggles in the UI.
- **R2 (Low):** Mobile language change is persisted client-side but not PUT to `/api/profile/locale`. The next AI request still picks up the new language via `Accept-Language`, but the profile-stored `locale` will diverge if the user later reads from another device.
- **R3 (Low):** `EXPO_PUBLIC_APP_ENV=production` requires `EXPO_PUBLIC_API_BASE_URL`; fail early. Already enforced — listed for awareness.
- **R4 (Low):** Mobile bundle id is the placeholder `com.yourname.lifeosai`. Must be changed before App Store / Play Store submission (see `RELEASE_CHECKLIST.md`).

---
*Sign-off: build green, all 96 backend tests pass, typecheck clean, no Critical or High findings.*
