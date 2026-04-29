# LifeOS AI

A proactive, 24/7 personal life OS. Mobile-first. One input box, smart
defaults, no forms unless you ask for them — type a sentence, the AI figures
out whether it's an expense / income / task / meal / sleep / mood and files
it in the right place.

> Curious about the *why*? Start with [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md)
> and [docs/UX_PRINCIPLES.md](./docs/UX_PRINCIPLES.md).

Currently at **Round 28 — production hardened**. Builds on round 18's
intelligence core with hygiene/security baseline (R19), privacy-aware
LifeSnapshot (R20), 3-tier capture routing + correction memory (R21),
atomic undo (R22), Home UX rewrite + Privacy + DevPanel (R23), assistant
streaming (R24), CI + smoke (R25), real mobile streaming client with
react-native-sse (R26), 127-test suite (R27), and orchestrator-grade
healthchecks + secrets rotation playbook (R28).

## Stack

| | |
|---|---|
| Mobile | **Bare** React Native 0.74 (not Expo) + TypeScript + Hermes |
| API | NestJS 10 + Prisma 5 + Postgres 16 |
| Queue | BullMQ on Redis 7 (skeleton wired; cron jobs round 19+) |
| Auth | argon2 + JWT access (15m) + rotating refresh (30d, hashed, theft sweep) |
| AI | Per-user OpenAI key, AES-256-GCM at rest, decrypted in-memory only |
| State (mobile) | Zustand (auth) + TanStack Query 5 (server cache) |
| Forms / validation | React Hook Form + Zod (shared between API + mobile) |
| i18n | i18next + react-native-localize, vi + en parity |
| Icons | react-native-vector-icons (Ionicons) — bundled at ~80KB |
| Charts | react-native-svg sparklines |
| Storage (mobile) | react-native-keychain (tokens) + AsyncStorage (cache) |
| Public HTTPS | Cloudflare Tunnel → `https://api.tothanhthuy.cloud` |
| Tooling | npm workspaces, Prettier, ESLint, Docker Compose |

## Repo layout

```
apps/
  api/             NestJS backend
    src/modules/
      auth · users · user-profile · user-ai-key
      tasks · finance · incomes · wallets · meals · sleep-mood
      capture · planner · assistant · dashboard · ai
      intelligence ← round 18 (UserContext, EventLog, BehaviorSummary,
                                AssistantMemory, InsightGenerator)
      privacy · notifications
  mobile/          React Native 0.74 (bare)
    src/
      screens/{auth,onboarding,main}
      components/{ui,home,today,quick-capture,assistant}
      services/api/             — apiClient + per-module wrappers
      hooks/                    — TanStack Query + intelligence hooks
      navigation/               — auth / onboarding / main stacks
      i18n/                     — vi + en
      theme/                    — Editorial Calm palette + tokens
packages/
  shared/          Zod schemas + TS types shared API ↔ mobile
docs/              Product, architecture, UX, security, round-by-round notes
scripts/          deploy-android.sh, connect-android.sh, dev-bootstrap.sh
```

## Round timeline (high-level)

| Round | What shipped |
|---|---|
| 0–4 | Monorepo + auth + Prisma 20-model schema + Quick Capture parser (37 tests) |
| 5–9 | OpenAI chat, recommendations engine, AI day-planner, settings + dev panel |
| 10 | Dashboard summary + profile PATCH + Home rewrite + onboarding rewrite |
| 11–13 | QuickCapture audit row, sleep "ngủ lúc X dậy Y" overnight pattern, AI plan personalization (snapshot + summary) |
| 14 | Six core CRUD modules (Tasks/Expenses/Wallets/Meals/Sleep/Mood) |
| 15 | **Smart-first redesign** — IncomeParser, /api/finance/timeline, SmartEntryScreen replaces hardcoded forms; AI auto-classifies kind + category |
| 16 | Audit fixes (P0+P1+P2) + responsive layout system (small phone → tablet) |
| 17 | Visual redesign — Ionicons everywhere, halo cards, sparklines, vertical timeline rail with current-time marker |
| 18 | **Full intelligence upgrade** — UserBehaviorSummary, EventLog stream, AssistantMemory, UserContext aggregator, LLM-driven insights, preferences (dislikes/allergies/budget/workPattern/monthlyGoal), smart nudges |
| 19 | **Hygiene baseline** — JWT type check, account lockout, log redaction, mobile env split |
| 20 | **LifeSnapshot upgrade** — Redis-cached snapshot service, privacy gating, real PrivacyModule controller |
| 21 | **Smart Capture** — 3-tier rule/LLM routing, editable preview for every kind, CaptureCorrection memory |
| 22 | **Undo** — atomic POST /capture/:id/undo + Hoàn tác snackbar with action button |
| 23 | **Mobile UX rewrite** — Home gọn lại, mode-specific quick actions, hidden DevPanel, Privacy screen |
| 24 | **Assistant streaming** — SSE pipeline + staged progress UX |
| 25 | **Productionised** — compose.{base,dev,prod}.yaml split, GitHub Actions CI, Maestro smoke flow, multi-stage Dockerfile |
| 26 | **Mobile streaming** — react-native-sse client, real progress events + live tokens, Stop / Hỏi lại buttons |
| 27 | **Tests** — @testing-library/react-native + jest setup, 22 mobile + 105 API tests (127 total) |
| 28 | **Hardening** — liveness/readiness/deep healthchecks, secrets rotation docs, deploy script, systemd unit, cloudflared sample |

## Run it locally

Prereqs:
- Node 20.12+
- Docker (for Postgres + Redis)
- For mobile builds: Android SDK 35 + JDK 21 (or Xcode)

```bash
# 1. Clone + envs
git clone <repo>
cd AppQuanLY
cp apps/api/.env.example apps/api/.env

# 2. Install
npm install
npm --workspace @lifeos/shared run build

# 3. Postgres + Redis (round 25 split: base + dev override)
docker compose -f compose.yaml -f compose.dev.yaml up -d

# 4. Migrate
cd apps/api && npx prisma migrate deploy && cd ../..

# 5. Run API
npm --workspace @lifeos/api run dev
```

Public API for mobile builds points at `https://api.tothanhthuy.cloud/api`
(Cloudflare Tunnel). Override with `LIFEOS_API_BASE_URL` at Metro bundle
time for local dev.

## Mobile builds (Android via Tailscale ADB)

The dev workflow on this repo deploys release APKs straight to a Xiaomi 13T
over Tailscale ADB:

```bash
# Connect once
bash scripts/connect-android.sh 100.118.234.3 5555

# Build + install + launch
bash scripts/deploy-android.sh release
```

Output goes to `apps/mobile/android/app/build/outputs/apk/release/`.

## API surface (current, post-round-18)

```
POST   /api/auth/{register,login,refresh,logout}
GET    /api/auth/me

GET    /api/profile                      ← preferredName, mainGoals, dislikes,
PATCH  /api/profile                       allergies, monthlyGoal, workPattern,
                                          budgetMonthly, usualWake/SleepTime
POST   /api/ai-key/setup-openai
GET    /api/ai-key/status

POST   /api/capture/parse                 ← rule + OpenAI fallback, returns
POST   /api/capture/confirm                kind ∈ EXPENSE/INCOME/MEAL/TASK/
                                          SLEEP/MOOD/UNKNOWN
POST   /api/quick-capture/{parse,confirm} (alias)

GET    /api/tasks?range=…
POST   /api/tasks
PATCH  /api/tasks/:id/complete
PUT    /api/tasks/:id
DELETE /api/tasks/:id

GET    /api/expenses?range=…
GET    /api/expenses/summary
POST   /api/expenses          + Idempotency-Key header
PUT    /api/expenses/:id      ← wallet adjusts by delta in $transaction
DELETE /api/expenses/:id      ← soft delete + refund wallet

GET    /api/incomes?range=…
POST   /api/incomes           + Idempotency-Key
PUT    /api/incomes/:id       ← wallet adjusts in same tx (increment)
DELETE /api/incomes/:id       ← soft delete + decrement

GET    /api/wallets
GET    /api/wallets/default   ← auto-creates "Ví chính" when missing
POST   /api/wallets

GET    /api/finance/timeline?range=…  ← mixed expense+income feed + totals + net

GET    /api/meal-logs?range=…
POST   /api/meal-logs

GET    /api/sleep-logs?range=…
POST   /api/sleep-logs
GET    /api/sleep/latest
GET    /api/mood-logs?range=…
POST   /api/mood-logs
GET    /api/mood/latest

GET    /api/dashboard/summary
GET    /api/daily-plan/today
POST   /api/daily-plan/today/generate
PATCH  /api/daily-plan/items/:id/status
PUT    /api/daily-plan/items/:id          ← round 18: title/time edit + EventLog

GET    /api/recommendations               ← LLM-driven via InsightGenerator
POST   /api/recommendations/refresh       (round 18) → falls back to rule
PATCH  /api/recommendations/:id/status     engine when no AI key

POST   /api/assistant/messages            ← injects UserContext + memories
GET    /api/assistant/conversations       (round 18)
GET    /api/assistant/conversations/:id
DELETE /api/assistant/conversations/:id

GET    /api/memory                        ← round 18: list, forget, confirm
DELETE /api/memory/:id                     long-term assistant memories
POST   /api/memory/:id/confirm
```

## Intelligence layer (round 18)

The app no longer asks the AI about the user from a thin snapshot. Every AI
call (planner, assistant, capture-fallback, insights) builds a **UserContext**:

```
UserContext = {
  profile,               // preferredName, mainGoals, usualWake/Sleep,
                         // dislikes, allergies, monthlyGoal, workPattern,
                         // budgetMonthly
  behavior,              // 7-day wake/sleep histograms, peak focus window,
                         // mood↔sleep correlation, top expense categories,
                         // task completion rate by priority, recent meal titles
  recentEvents,          // last 30 EventLog rows (capture / plan / task /
                         // insight feedback)
  memories,              // top 10 AssistantMemory facts ("user prefers cơm gà")
  lastSleepMinutes,
  lastMood,
  todaySpendVnd,
  monthSpendVnd,
  openHighPriorityTaskCount,
}
```

- **EventLog** is append-only; ConfirmService / PlannerService / TasksService /
  RecommendationsService all write to it as their actions complete.
- **BehaviorSummary** is recomputed lazily (1h TTL) or eagerly after sleep /
  expense / income confirms. Stored in `UserBehaviorSummary` so AI calls don't
  re-aggregate 90 days every time.
- **AssistantMemory** is extracted by a fire-and-forget LLM job after each
  chat turn. Top-weight memories (max 10) are injected into subsequent system
  prompts. The user can audit + delete via Settings → AI memory.

## Documentation

| Doc | What's in it |
|---|---|
| [PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | What we're building |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Big-picture diagrams |
| [UX_PRINCIPLES.md](./docs/UX_PRINCIPLES.md) | The ten rules every screen passes |
| [QUICK_CAPTURE.md](./docs/QUICK_CAPTURE.md) | The single-input pipeline |
| [SMART_ENTRY.md](./docs/SMART_ENTRY.md) | Round-15 capture redesign |
| [CORE_FLOWS.md](./docs/CORE_FLOWS.md) | Tasks/Expenses/Meals/Sleep+Mood flows |
| [HOME_DASHBOARD.md](./docs/HOME_DASHBOARD.md) | Home tab structure |
| [ONBOARDING.md](./docs/ONBOARDING.md) | 3-step first-launch flow |
| [AESTHETIC_ROUND17.md](./docs/AESTHETIC_ROUND17.md) | Visual redesign notes |
| [AUDIT_ROUND16.md](./docs/AUDIT_ROUND16.md) | Audit fixes + responsive system |
| [INTELLIGENCE_ROUND18.md](./docs/INTELLIGENCE_ROUND18.md) | This round's intelligence upgrade |

## Status

- API: 18 modules, **105/105 jest tests** pass, TS clean.
- Mobile: 20 screens, 30+ components, 17 services, 12+ hooks, **22 jest tests**, TS clean.
- APK ~59 MB, deployed via Tailscale ADB to Xiaomi 13T.
- Public API: `https://api.tothanhthuy.cloud/api` (Cloudflare Tunnel).
- Health: `/health` (liveness), `/health/ready` (DB + Redis), `/health/deep`
  (snapshot version + encryption key check).
- CI: `.github/workflows/ci.yml` runs lint/typecheck → API tests → mobile
  typecheck/tests → Android debug APK on every push.
- Smoke: `maestro test .maestro/smoke.yaml` against a connected device for
  register → capture → save → undo → privacy round-trip.

## Production deploy (round 28)

```bash
# Idempotent zero-downtime-ish deploy script:
bash scripts/deploy-prod.sh

# Or manually:
docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
  build api
docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
  run --rm --no-deps api npx prisma migrate deploy
docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
  up -d --no-deps api
```

systemd unit (auto-start on boot): see [docker/lifeos-api.service](./docker/lifeos-api.service).
Cloudflare Tunnel template: see [docker/cloudflared.config.example.yml](./docker/cloudflared.config.example.yml).
Secrets rotation playbook: [docs/SECRETS.md](./docs/SECRETS.md).
