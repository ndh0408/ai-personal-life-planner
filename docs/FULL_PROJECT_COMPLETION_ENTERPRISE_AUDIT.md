# LifeOS AI — Full Project Completion Enterprise Audit (Round 11, updated after Round 12)

> **Round 12 update (2026-04-25):** the 5 P0 infrastructure blockers below
> have been closed. See `docs/ROUND_12_INFRA_P0_COMPLETION.md` for the
> implementation report. This audit document is preserved as the original
> Round-11 finding; the **§14 Scalability + Capacity Planning** and **§21
> Priority Fix Plan** sections have been updated in-place at the bottom to
> reflect post-Round-12 reality.

**Audit date:** 2026-04-25
**Branch:** `master` @ `0447efa` + round 11 fixes (request-id middleware, graceful shutdown, refresh-token reuse-breach detection, OAuth state HMAC verification, mobile 401 full teardown, i18n parity restore)
**Auditors (composite role):** Principal Software Architect · Staff Security Engineer · Principal SRE · Mobile Release Engineer · AI Platform Auditor · Fintech Logic Auditor
**Scope:** monorepo `/home/huy/AppQuanLY` — `apps/api` (NestJS 10 + Prisma 5.22 + PostgreSQL 16) · `apps/mobile` (Expo SDK 51 + React Native + TypeScript) · `packages/shared` (Zod schemas + DTOs)
**Method:** direct read of 177 backend `.ts` files + 31 spec files + 141 mobile files + 23 shared schema files; 4 parallel sub-agent re-audits (Finance / Security / Scalability / Mobile-AI-Privacy); 9 Prisma migrations applied this release; full `npm run typecheck` + 31/31 jest suites (151/151 tests) green after fixes.

---

## 1. Final Verdict

| Question | Answer |
|---|---|
| Code compiles cleanly (api + mobile + shared)? | **YES** — `tsc --noEmit` clean both apps |
| All 151 backend tests pass? | **YES** — 31/31 suites green |
| i18n vi/en parity exact? | **YES** — 1329 ⇄ 1329 keys, set-difference empty |
| **Production-ready for ≤10k MAU pilot?** | **YES — with 5 dispatcher fixes (P0)** |
| **Enterprise-ready for 100k–500k MAU?** | **NO — 5 P0 + 6 P1 must land first** |
| **Million-MAU ready (no Redis, no queue, no APM)?** | **NO — capacity ceiling estimated 60–80k DAU** |
| App-Store / Play-Store privacy-readiness? | **CONDITIONAL** — privacy posture YES, missing email-verification + forgot-password endpoints are blocker |

**Headline:** the project is materially production-grade for a pilot launch. Privacy, security, AI gating, mobile UX, finance correctness on the **happy path**, and i18n are all solid. What is **not** production-grade for hyperscale: there is no async work runner (no queue, no scheduler, no worker), the throttler is in-memory (HA-incompatible), spend on the platform AI key is uncapped per-user, and notification rows accumulate forever because no dispatcher drains them.

---

## 2. Feature Completion Matrix

| # | Module | Backend | Mobile | DB | i18n vi/en | Tests | Docs | Status |
|--|--|--|--|--|--|--|--|--|
| 1 | Auth (JWT access + RTR refresh) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 2 | Onboarding (5-step + locale sync) | ✅ | ✅ | ✅ | ✅ | — | ✅ | DONE |
| 3 | Tasks / Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 4 | Habits | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 5 | Meals planner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 6 | Health logs (sleep/mood/energy) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 7 | Finance (incomes / expenses / wallets / budgets / debts / saving-goals) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE — 9 known race / multi-currency issues open |
| 8 | Personal Goals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 9 | Reports (daily / weekly / monthly / goal-progress) | ✅ | ✅ | ✅ | ✅ | — | ✅ | DONE — Number(decimal) lossy on USD-cent-scale |
| 10 | Dashboard aggregator | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE — multi-currency sum still naive |
| 11 | Personal Assistant Engine + recommendations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 12 | AI providers (BYOK, AES-256-GCM, SSRF blocklist) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 13 | AI assistants (chat / planner / finance / meal / insight / health-screen) | ✅ | ✅ | n/a | ✅ | ✅ | ✅ | DONE |
| 14 | Privacy Center v1 (master + per-domain gates, export, delete-account) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 15 | Privacy v2 (granular personalization, AI memory clear, evidence trail) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 16 | Communication assistant (settings + reminders, OAuth shape) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE — token-exchange v1.3 |
| 17 | AI Companion Memory (sensitive gate) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 18 | Voice Companion + Quick Capture | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE — STT is stub |
| 19 | Smart Check-ins | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 20 | Context Inference Engine (rule-based) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE |
| 21 | Home-screen Widgets (data layer + privacy-shaped summary + deep-links) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | DONE — native widget extension still TBD |
| 22 | Offline cache + sync queue | n/a | ✅ | n/a | ✅ | — | ✅ | DONE |
| 23 | Notifications (Expo push) | ✅ | ✅ | ✅ | ✅ | — | ✅ | **GAP** — log row written but no dispatcher reads it |
| 24 | Production deploy (Dockerfile + compose + scripts) | ✅ | n/a | n/a | n/a | — | ✅ | DONE |

**Coverage:** 24/24 product modules ship code. 5/24 carry **known** correctness or operational gaps documented in §9, §13, §14.

---

## 3. End-to-End User Flow Audit

I walked the 12 critical user flows by reading the code path top to bottom. Each result is one of: ✅ correct · ⚠ correct but degraded · ❌ broken.

| # | Flow | Result | Notes |
|--|--|--|--|
| 1 | Register → onboarding → first dashboard | ✅ | Skeleton-profile detection (`auth.store.ts:33-43`) routes new users to onboarding. Locale sync to backend on completion. |
| 2 | Login → token issue → me() → cached state hydrate | ✅ | RTR refresh with sha256 hashed tokens; reuse-breach now revokes whole family (round-11 fix). |
| 3 | Logout (manual) | ✅ | Wipes `tokenStore` + offline state + widget snapshot + react-query cache + state. |
| 4 | Forced 401 → reactive logout | ✅ (round 11) | Now uses **identical** teardown as manual logout (extract-and-share `wipeClientState()`). Was leaving widget snapshot stale. |
| 5 | Add expense → wallet balance | ✅ | `$transaction` + atomic decrement; wallet `balance` write removed; one-pass spec-verified. |
| 6 | Add expense in foreign currency → dashboard sum | ⚠ | Sums numerically across currencies (no FX). Dashboard total can be meaningless for multi-currency users. (§9 #3) |
| 7 | Pay debt → debt balance + transaction | ❌ race | `addPayment` reads-then-writes outside `$transaction` (debts.service.ts:90-117). Concurrent payments overwrite. (§9 #1) |
| 8 | Contribute to saving-goal | ❌ race | Same read-then-write pattern (saving-goals.service.ts:92-112). (§9 #2) |
| 9 | AI chat with platform key | ⚠ | Works but no per-user daily cap. One user can drain ~17k req/day per route. (§5 #4) |
| 10 | AI chat with BYOK custom URL | ✅ | SSRF blocklist enforced at CRUD AND fetch time (DNS rebinding closed). |
| 11 | Privacy: opt-out finance personalization → run AI finance | ✅ | `aiGates(userId).finance === false` short-circuits at every call site (verified across 7 services). |
| 12 | Account deletion | ✅ | Endpoint exists `privacy.controller.ts:108`; cascades via Prisma `onDelete`. |
| 13 | Widget on lock-screen renders stale data after server-side ban | ✅ (round 11) | Was open; closed by full teardown in 401 handler. |
| 14 | Mobile open lifeos://expense/new from external link | ✅ | Allow-list rejects non-`lifeos:` schemes before consulting closed ROUTES table. |
| 15 | Quick-capture voice → suggested action → confirm | ✅ | Always PENDING; `markConfirmed` only fires after user tap; 24h expiry. |
| 16 | Sensitive memory write (HEALTH/FINANCE/RELATIONSHIP) without `userConfirmed=true` | ✅ | Throws `SENSITIVE_MEMORY_REQUIRES_CONFIRM`; tested both branches. |

---

## 4. Architecture (Backend / Mobile / Shared)

### Backend — NestJS modules
- 24 feature modules, each with `controller.ts` + `service.ts` (+ `service.spec.ts` for 31 of them).
- Cross-cutting: `PrismaService` (singleton), `EncryptionService` (AES-256-GCM), `AiProviderService` (mock + openai + ollama drivers), `AiProviderResolverService` (BYOK fallback), `AllExceptionsFilter` (now request-id-aware), `JwtAuthGuard` (every controller except health), `ThrottlerGuard` (per-IP, in-memory).
- 9 Prisma migrations land cleanly (`db pull` matches `db push`); zero schema drift.
- `requestIdMiddleware` (round 11) — uuid generated or trusted from header (capped 64 chars), echoed on response, included in 5xx log line.
- `app.enableShutdownHooks()` (round 11) — Prisma `$disconnect` runs on SIGTERM so `docker stop` doesn't drop in-flight requests.

### Mobile — Expo
- 141 source files. React Navigation v6 native-stack. `@tanstack/react-query` + `zustand` for state. Offline cache + sync queue at `services/offline/`. Token store via `expo-secure-store`. i18n via `i18next` + `react-i18next` (1329 keys per locale).
- `App.tsx` wraps everything in `ErrorBoundary` (logs `name`/`message` only — never user payload).
- Deep link router at `services/deep-link.ts` — closed allow-list of routes, scheme guard rejects non-`lifeos:`.

### Shared — `@planner/shared`
- Zod schemas for every DTO; `.max(1e13)` upper-bound on every monetary field; Zod errors mapped to `VALIDATION_FAILED` errorCode by `ZodValidationPipe`.

**Architecture grade: A-.** Modular, no circular dependencies, no service-locator anti-pattern, controllers thin, Prisma calls scoped to services. Lacks: domain-event bus, async work runner, feature-flag system.

---

## 5. Backend (NestJS API) — Security + Reliability

### PASS
- Every controller declares `@UseGuards(JwtAuthGuard)` except `health.controller.ts` (by design).
- IDOR — every controller resolves the resource owner via `@CurrentUser()`. Zero `body.userId / query.userId / params.userId` patterns; verified with `grep -rE '(body|query|params)\.userId' apps/api/src/modules`.
- 5xx error leak — `AllExceptionsFilter:90-92` collapses to `"Internal server error"` in prod.
- Production env gates — `env.validation.ts:36-67` enforces concrete `CORS_ORIGIN`, distinct JWT secrets, `AI_PROVIDER_ENCRYPTION_KEY ≥32 chars`, `AI_API_KEY` when non-mock.
- AES-256-GCM for BYOK provider keys + (future) OAuth tokens.
- SSRF blocklist (`user-provider.builder.ts:61-133`) covers v4 RFC1918, loopback, 169.254/16 metadata, IPv6 `::`, `::1`, `fe80:`, `fc/fd`, `::ffff:` recursive — applied at CRUD time **and** at fetch time (closes DNS rebinding).
- Refresh-token reuse-breach detection — round-11 fix: presenting a revoked token now revokes the entire family (auth.service.ts:87-106).
- OAuth state hardening — round-11 fix: HMAC re-derived + `timingSafeEqual` + provider-mismatch guard (connected-accounts.service.ts:103-160).

### Open
- **HIGH** — Login throttle is per-IP only (10/min). No `User.failedLoginAttempts` / `lockedUntil`. Distributed credential-stuffing across many IPs is not slowed.
- **HIGH** — No per-user AI daily cap. One authenticated user can drain ~17k req/day × 7 routes against the platform-side AI key. No `AiUsageLog` table; token counts go to logger only.
- **MED** — `AI_PROVIDER_ENCRYPTION_KEY` reused for AES-GCM at-rest AND OAuth-state HMAC (line 57). Domain-separate before v1.3 ships token exchange.
- **MED** — No `forgotPassword`, `verifyEmail`, or `User.emailVerified` column. App Store reviewers may flag.
- **LOW** — No admin surface (`@Roles('ADMIN')` returns zero hits). Acceptable for pilot.

---

## 6. Auth (Register / Login / Refresh / Logout)

| Aspect | State |
|---|---|
| Password hashing | bcrypt cost 10 |
| JWT access | HS256, 15m default |
| JWT refresh | HS256, 30d default, sha256-hashed in DB, single-use rotation |
| **Reuse-breach detection** | ✅ round-11 — revokes family + throws |
| Per-IP login throttle | 10/min |
| Per-account lockout | ❌ not implemented |
| Email verification | ❌ not implemented |
| Forgot-password | ❌ not implemented |
| 2FA / MFA | ❌ not in v1.3 scope |
| Token storage (mobile) | `expo-secure-store` (iOS Keychain / Android EncryptedSharedPreferences) |
| Logout teardown | ✅ wipes 4 stores (token, offline, widget snapshot, react-query) |
| Reactive 401 teardown | ✅ round-11 — same `wipeClientState()` as logout |

---

## 7. Mobile App (React Native / Expo)

### PASS
- Zero AI keys in mobile bundle (verified — only mobile fetch outside the typed `api` client is `network-status.ts:66` health probe).
- Zero direct mobile→AI-provider fetches (no `api.openai.com` / `anthropic.com` strings in mobile source).
- Logout teardown — wipes `tokenStore` → `resetOfflineState` (cache + sync queue) → `widgetSnapshotStore.clear` → `queryClient.cancelQueries+clear` → state reset.
- ErrorBoundary at root — logs only `error.name+message`, never user payload.
- Deep-link allow-list — protocol guard then closed routes table.
- i18n parity exact — 1329 ⇄ 1329, no missing keys, all hardcoded fragments fixed in round 11.

### Open
- **LOW** — Native widget extensions for iOS WidgetKit + Android Glance not yet wired (`docs/WIDGETS.md` documents the contract; widget data layer + privacy shaping is fully implemented backend-side and consumed in WidgetSettingsScreen preview).

---

## 8. Database (Prisma + PostgreSQL)

### Schema scale
- 9 migrations applied this release (BYOK, privacy v1+v2, communication, voice, context, widgets).
- 38 tables total. Hot tables (≥1 row per user per active day): `expenses`, `notification_logs`, `ai_messages`, `schedule_items`, `habit_logs`, `mood_logs`, `voice_captures`, `suggested_actions`, `context_signals`, `context_inferences`, `email_items`, `ai_companion_memories`, `sensitive_access_logs`, `recommendation_evidences`.

### Indexes
PASS — every hot table has the userId+createdAt compound index (or a tighter equivalent). No N+1 queries observed; finance services use `findMany` with `where` not loops.

### Connection pool
- `DATABASE_URL` documented to include `?connection_limit=10&pool_timeout=15` in `.env.production.example`.
- Prisma default is `num_physical_cpus * 2 + 1` — must be set explicitly when running multi-replica.

### Open
- **HIGH** — Unbounded write-only tables: `notification_logs`, `sensitive_access_logs`, `context_signals`, `email_items`, `recommendation_evidences`. No archival, no partitioning, no TTL. At 1M MAU × 100 days these grow to billions of rows.
- **HIGH** — Backups via `pg_dump` to local disk (`scripts/backup-db.sh`). No encryption-at-rest on the dump file. No off-box destination (S3 / GCS).
- **MED** — No `AuditLog` table. No `idempotencyKey` column on finance writes.
- **MED** — No soft delete on finance models (deleting a wallet hard-deletes its expenses by cascade).

---

## 9. Finance Logic (Re-audit after v1.0+ hardening)

3 of 12 prior issues closed; 9 remain open. Finance correctness on the **happy path** is sound — these are the multi-write / multi-currency / lossy-conversion edges.

### Closed (round 7+ hardening)
1. ✅ Wallet balance write removed — verified, balance derived not stored.
2. ✅ Income/Expense create/update/delete wrapped in `$transaction` with atomic increment/decrement.
3. ✅ `.max(1e13)` cap added to every monetary Zod schema.

### Still open
| # | Severity | Issue | Evidence |
|--|--|--|--|
| 1 | **HIGH** | Debt `addPayment` race | read-then-write outside `$transaction` — `debts.service.ts:90-117` |
| 2 | **HIGH** | SavingGoal `contribute` race | same pattern — `saving-goals.service.ts:92-112` |
| 3 | **HIGH** | Multi-currency aggregation unsafe | `dashboard.service.ts:196` sums numerically across currencies |
| 4 | **HIGH** | `Number(decimal)` lossy on cent-scale | `reports.service.ts:34-39` |
| 5 | MED | No `Idempotency-Key` middleware | duplicate POSTs from retried mobile syncs can double-write |
| 6 | MED | No `AuditLog` table | who/when changed what is unrecoverable |
| 7 | MED | No soft delete | wallet delete hard-cascades expenses |
| 8 | LOW | Timezone bug in daily reports | uses server clock for "today" instead of `userProfile.timezone` |
| 9 | LOW | No decimal-overpay tolerance on debt closeout | a 0.01-cent rounding leaves balance non-zero |

---

## 10. AI Safety + Personalization Gates

PASS-by-design. Audit found **zero violations** across 7 AI services.

| Check | Result |
|---|---|
| `aiGates(userId)` — master AND per-domain compounding | ✅ verified at every call site (`ai-daily-review`, `ai-finance`, `ai-meal`, `ai-planner`, `ai-chat`, `ai-insight`, `widget-summary`) |
| Sensitive memory gate (HEALTH/FINANCE/RELATIONSHIP requires `userConfirmed=true`) | ✅ `companion-memory.service.ts:15-19,56` — both branches tested |
| Prompt-injection sanitizer | ✅ escapes `&lt;`/`&gt;`, strips U+2028/U+2029, U+200B-U+200F, U+FEFF, `\p{Cc}`, `` ` ``, `"""`; tests cover both |
| AI fallback on upstream 5xx | ✅ resolver falls back to platform mock provider, never bubbles 5xx to mobile |
| AI response JSON validation + repair | ✅ `AiJsonValidationService` repairs single-pass; falls back gracefully when invalid |
| Mobile ai-health screen vi+en | ✅ 6 EN + 11 VI keywords, NFC-normalized lowercase comparison |
| Quick-capture auto-apply | ✅ never — always PENDING `SuggestedAction` until `:id/confirm` |

### Open
- **HIGH** — Per-user AI daily cap missing (see §5 #4). Add `AiUsageLog{userId, route, tokensIn, tokensOut, costCents, createdAt}` + Redis daily counter.

---

## 11. Privacy Center (v1 + v2)

| Capability | State |
|---|---|
| Master `personalizationEnabled` toggle | ✅ |
| Per-domain consent (schedule, habits, meals, health, finance, goals, calendar, healthFitness, location, voice, behaviour) | ✅ |
| One-tap "Enable recommended" + bulk Customize | ✅ |
| Recommendation evidence trail per nudge | ✅ |
| AI memory inspection + clear all | ✅ |
| Data export (JSON download) | ✅ |
| Account deletion (immediate cascade) | ✅ |
| Sensitive-access audit log (`sensitive_access_logs`) | ✅ written, no UI to surface |
| Widget privacy mode (FULL / HIDE_SENSITIVE / MINIMAL) | ✅ |
| Widget `finance.amounts` field-absent (not zero) when opt-out | ✅ verified `widget-summary.service.ts:178-184` spread-or-omit |

**Privacy posture grade: A.** Strong defaults, surface-area for granular control, sensitive memory locked behind explicit confirm, AI gating cascades to widget contract.

---

## 12. Communication / Voice / Context Modules

| Module | Backend | Mobile | Notes |
|---|---|---|---|
| Communication settings | ✅ | ✅ | Per-channel mute, quiet hours, escalation rules |
| OAuth account-link (Gmail / Outlook) | ⚠ shape only | ✅ start UI | `completeOAuth` throws OAUTH_NOT_CONFIGURED until v1.3 wires upstream token exchange. State HMAC + provider-mismatch hardened in round 11. |
| Email reminders | ✅ | ✅ | Reads from `email_items`; classifier tags BILL_DUE / MEDICAL / FAMILY |
| Message reminders | ✅ | ✅ | Same shape, different source |
| Voice companion + STT | ⚠ stub | ✅ | `speech-to-text.service.ts:38-50` returns `{transcript:'', notImplemented:true}` |
| Quick capture | ✅ | ✅ | 24h expiry, never auto-apply, requires explicit `:id/confirm` |
| Smart check-ins | ✅ | ✅ | Server-side scheduled checks, mobile composes the response |
| Context inference engine | ✅ | ✅ | Rule-based (no AI in v1.2). 6 rule types: POSSIBLE_SLEEPINESS, WORKLOAD_OVERLOAD, BUDGET_BURN, MEAL_GAP, MOOD_DIP, GOAL_DRIFT |

---

## 13. Widget Module

| Aspect | State |
|---|---|
| Server `widget-summary` endpoint | ✅ privacy-shaped output |
| `finance.amounts` field-absent when opt-out | ✅ verified |
| Privacy modes (FULL / HIDE_SENSITIVE / MINIMAL) | ✅ |
| Mobile snapshot store (file-based mirror for native widget) | ✅ wiped on logout AND on 401 (round 11) |
| Deep-link router for widget actions | ✅ `lifeos://` scheme + closed allow-list |
| Native iOS WidgetKit extension | ❌ not yet — backend + contract done, native target TBD |
| Native Android Glance app widget | ❌ not yet — same |

The data layer is production-ready; the native widget targets are a separate native build effort tracked outside this audit.

---

## 14. Scalability + Capacity Planning

**Estimated capacity ceiling: 60–80k DAU on the current architecture.**

Bottlenecks ranked by what actually breaks first:

| # | Bottleneck | Where it bites | Fix tier |
|--|--|--|--|
| 1 | **Notification dispatcher does not exist** — `notification_logs` rows accumulate as PENDING forever; no worker drains them | At any scale; mobile users never receive scheduled push | **P0** |
| 2 | **No async runner** (no BullMQ, no `@nestjs/schedule`, no cron container) | Anything multi-step or scheduled (proactive nudge sweep, daily-review precompute, archival) | **P0** |
| 3 | **In-memory throttler** (`ThrottlerModule.forRootAsync` in `app.module.ts:63` — no `storage` option) | First multi-replica deploy; throttle counters fragmented per pod | **P0** |
| 4 | **No observability** — no Sentry, no Prometheus exporter, no APM | First production incident; can't diagnose | **P0** |
| 5 | **Plaintext local backups** (`scripts/backup-db.sh` writes to disk, no encryption, no off-box destination) | First lost host or compliance review | **P1** |
| 6 | Unbounded write-only tables (notification_logs, sensitive_access_logs, context_signals, email_items, recommendation_evidences) | Year 2; scan + index sizes blow up | **P1** |
| 7 | No connection-pool side-car (PgBouncer/Pgpool); raw Prisma connections only | 5–10 replicas; PG max_connections saturates | **P1** |
| 8 | Single Postgres primary (no replica, no automatic failover) | First DB host failure | **P2** |
| 9 | `pg_dump` backups not point-in-time (no WAL archiving) | Recoverable RPO is "since last nightly dump" | **P2** |
| 10 | No CDN in front of API | 1M+ MAU; static asset egress | **P2** |

**Note:** items 4 (graceful shutdown specifically) and 1 (request-id) were fixed in round 11. Items still open above.

---

## 15. Reliability / SRE

| Aspect | State |
|---|---|
| Health endpoint | ✅ `/health` (DB ping + uptime) |
| Liveness vs readiness probes | ⚠ same endpoint serves both |
| Graceful shutdown | ✅ round-11 — `app.enableShutdownHooks()` runs `PrismaService.$disconnect` on SIGTERM |
| Request-id (incoming or generated, echoed in response, included in 5xx log) | ✅ round-11 |
| Structured 5xx log line (`[req=...] METHOD url → status [errorCode]`) | ✅ round-11 |
| In-flight request draining | ⚠ `enableShutdownHooks` triggers Prisma disconnect; no explicit "stop accepting new" + drain timeout |
| Crash + restart (PM2 / k8s liveness) | ⚠ no `pm2.config.js`, no k8s manifests in repo; docker-compose `restart: unless-stopped` only |
| Multi-replica safety | ❌ throttler in-memory; no shared cache |
| Disaster recovery runbook | ✅ `docs/DEPLOY_BACKEND_PRODUCTION.md` covers backup/restore |
| RPO / RTO targets documented | ❌ |

---

## 16. Observability (Logs / Metrics / Traces)

| Aspect | State |
|---|---|
| Structured logs | ⚠ `Logger` from Nest; not JSON; no correlation field beyond round-11 request-id |
| 5xx log entries | ✅ round-11 — include request id, method, url, status, errorCode |
| Stack traces in 5xx | ✅ |
| Per-user log redaction | ✅ never logs payloads / secrets / tokens |
| Sentry / Bugsnag / Datadog | ❌ not wired |
| Prometheus / OpenMetrics exporter | ❌ not wired |
| Distributed tracing (OpenTelemetry) | ❌ not wired |
| Mobile crash reporter | ❌ Expo's default only |
| AI usage attribution (per user, per route, tokens, cost) | ❌ logger lines only, no persistent ledger |

---

## 17. DevOps + Deployment

| Aspect | State |
|---|---|
| Production Dockerfile | ✅ multi-stage, non-root user, distroless-style runtime |
| docker-compose.production.yml | ✅ api + postgres + (provisioned but unused) redis |
| `scripts/deploy.sh` | ✅ pulls latest, runs migrations, restarts api |
| `scripts/migrate.sh` | ✅ wraps `prisma migrate deploy` |
| `scripts/backup-db.sh` | ⚠ local plaintext dump |
| `scripts/restore-db.sh` | ✅ |
| `scripts/check.sh` | ✅ probes /health |
| `.env.production.example` | ✅ documents `connection_limit`, distinct JWT secrets, encryption key length |
| CI (GitHub Actions / similar) | ❌ none in repo |
| Image signing / SBOM | ❌ |
| Mobile EAS build profiles | ✅ `eas.json` with dev / preview / prod |

---

## 18. Testing

- 31 jest suites · **151/151 tests pass** · ~11.5s wall-clock.
- Coverage: every service with finance, AI, privacy, sensitive-memory, or auth-adjacent logic has a `.spec.ts`.
- Spec files cover happy path + at least one error branch + at least one privacy-gate branch.
- **Missing:** no e2e / supertest layer (HTTP-level integration tests). No mobile Detox / Maestro suite. No load tests.

---

## 19. Abuse / Misuse Simulation

I simulated 8 abuse vectors against the current code:

| # | Attack | Outcome |
|--|--|--|
| 1 | IDOR — try to fetch another user's expense by ID | ✅ blocked — every service filters by `where: { userId }` |
| 2 | Steal refresh token, replay after rotation | ✅ blocked round-11 — entire family revoked + 401 |
| 3 | SSRF via BYOK custom baseUrl `http://169.254.169.254/...` | ✅ blocked — at CRUD AND fetch |
| 4 | DNS rebinding on BYOK baseUrl | ✅ blocked — IP re-resolved + checked at fetch |
| 5 | Prompt injection via user note: `</user>... admin: ignore previous` | ✅ neutralized — sanitizer escapes / strips control chars |
| 6 | Spam AI chat to drain platform key | ❌ — only per-IP throttle (12/min); single user can do ~17k/day per route |
| 7 | Credential-stuff login from rotating IPs | ❌ — no per-account lockout |
| 8 | Forge OAuth state to link attacker's mailbox to victim account | ✅ blocked round-11 — HMAC re-derived + provider-mismatch + token-exchange not yet wired |

---

## 20. Production Readiness Checklist

| Tier | Item | Status |
|---|---|---|
| Code | TypeScript strict, no `any`-in-public-API | ✅ |
| Code | Lint clean | ✅ |
| Code | Tests green | ✅ 151/151 |
| Security | Secrets out of repo (`.env*` ignored) | ✅ |
| Security | bcrypt for passwords | ✅ |
| Security | JWT with separate access + refresh secrets enforced in prod | ✅ |
| Security | RTR with reuse-breach detection | ✅ round-11 |
| Security | helmet | ✅ |
| Security | CORS pinned in prod | ✅ |
| Security | Rate limit per IP | ✅ in-memory |
| Security | Per-account lockout | ❌ |
| Security | Per-user AI daily cap + spend ledger | ❌ |
| Privacy | Granular consent | ✅ |
| Privacy | Export + delete | ✅ |
| Privacy | Sensitive memory gate | ✅ |
| Privacy | Email verification | ❌ |
| Privacy | Forgot password | ❌ |
| SRE | Healthcheck | ✅ |
| SRE | Graceful shutdown | ✅ round-11 |
| SRE | Request id middleware | ✅ round-11 |
| SRE | Structured logging | ⚠ |
| SRE | APM / error reporting | ❌ |
| SRE | Multi-replica safe (shared throttle/cache) | ❌ |
| SRE | Async work runner (queue + worker + scheduler) | ❌ |
| SRE | Notification dispatcher | ❌ |
| SRE | Encrypted off-box backups | ❌ |
| Mobile | Token in secure storage | ✅ |
| Mobile | Logout teardown complete | ✅ |
| Mobile | 401 reactive teardown complete | ✅ round-11 |
| Mobile | i18n parity | ✅ 1329 ⇄ 1329 |
| Mobile | Deep-link allow-list | ✅ |
| Mobile | ErrorBoundary at root | ✅ |

**Pilot (≤10k MAU) verdict: GO**, with the dispatcher gap accepted as known (push notifications won't fire until §22 #1 lands).
**100k MAU verdict: BLOCK** until P0 list closes.
**1M MAU verdict: BLOCK** until P0 + P1 close + capacity-test pass.

---

## 21. Priority Fix Plan — Top 10 Blockers

Ordered by what bites first in production. P0 = must-land before pilot push-notification feature; P1 = before 100k MAU.

| # | Tier | Fix | Effort |
|--|--|--|--|
| 1 | **P0** | Notification dispatcher worker — install BullMQ + Redis + worker container that reads `notification_logs` PENDING rows and POSTs to Expo push | 1–2 days |
| 2 | **P0** | Async work runner — same BullMQ install enables `@nestjs/schedule` `@Cron` decorators for proactive-nudge sweep, daily-review precompute, archival jobs | 0.5 day on top of #1 |
| 3 | **P0** | Throttler → Redis-backed (`@nest-lab/throttler-storage-redis`); same Redis box as #1 | 0.5 day |
| 4 | **P0** | Per-user AI daily cap — add `AiUsageLog` table + Redis daily counter + 429 with `RATE_LIMIT_EXCEEDED` | 1 day |
| 5 | **P0** | Sentry (or equivalent) — wire `@sentry/node` interceptor + `@sentry/react-native` on mobile; gate all 5xx + uncaught | 0.5 day |
| 6 | **P1** | Per-account login lockout — add `User.failedLoginAttempts` + `lockedUntil`; bump on bad password; refuse for N min after threshold | 0.5 day |
| 7 | **P1** | Email verification + forgot-password — `User.emailVerified`, signed token via `jwt.signAsync`, transactional email via SES/Postmark | 1 day |
| 8 | **P1** | Encrypted off-box backups — `backup-db.sh` pipes through `gpg --symmetric` then `aws s3 cp` with retention policy | 0.5 day |
| 9 | **P1** | Multi-currency aggregation — store `Wallet.currency`; reject mixed-currency totals OR convert via stored FX rates | 1 day |
| 10 | **P1** | Debt + SavingGoal write races — wrap `addPayment` / `contribute` in `$transaction` with conditional update + atomic decrement | 0.5 day |

---

## 22. Safe Auto-fixes Applied This Round

These were applied in round 11. All low-risk, all behind existing tests, all green.

| # | File | Fix |
|--|--|--|
| 1 | `apps/api/src/common/middleware/request-id.middleware.ts` (NEW) | Generates uuid (or trusts incoming `x-request-id` capped at 64 chars), echoes on response. |
| 2 | `apps/api/src/main.ts` | Wires `requestIdMiddleware` after `helmet`; adds `app.enableShutdownHooks()` so Prisma disconnects on SIGTERM. |
| 3 | `apps/api/src/common/filters/all-exceptions.filter.ts` | Reads `req.requestId`, includes in 5xx log line, returns it in JSON error body. |
| 4 | `apps/api/src/modules/auth/auth.service.ts` | When a presented refresh token is **revoked** (RTR §6.1 reuse-breach), revoke the entire family for that user before throwing. |
| 5 | `apps/api/src/modules/communication/connected-accounts.service.ts` | `completeOAuth` now: re-derives HMAC over `userId:provider:nonce`, `timingSafeEqual` against the sig fragment of the state, asserts `entry.provider === _provider`. |
| 6 | `apps/mobile/src/store/auth.store.ts` | Extracted `wipeClientState()` from `logout()`; both `logout()` and the reactive 401 handler now call it (closes widget snapshot stale-after-ban gap). |
| 7 | `apps/mobile/src/screens/widgets/WidgetSettingsScreen.tsx` + `apps/mobile/src/screens/privacy/PersonalizationConsentScreen.tsx` | Replaced 4 hardcoded English fragments with i18n calls (`healthSummary`, `healthSleep`, `budgetWarningRow`, `recommendedSummary`). |
| 8 | `apps/mobile/src/i18n/locales/{en,vi}.json` | Added the 4 new keys to both locales — parity remains exact at 1329 ⇄ 1329. |

**Not applied** (would require migrations / architecture decisions / new services): notification dispatcher, BullMQ + Redis throttler, AiUsageLog table, per-account lockout, email verification, encrypted backups, multi-currency FX, finance race-fix transactions.

---

## 23. Final Output

### Headline grade: **A− for pilot, B for 100k-scale, C for million-scale.**

The codebase is materially better than typical solo-built monorepo apps at this stage. The privacy posture, AI safety gates, sanitization, BYOK encryption + SSRF defence, mobile teardown discipline, i18n parity, and test coverage are all unusually thorough. The auth flow is now textbook-correct including RTR reuse-breach. Round 11's request-id + graceful shutdown + 401 full-teardown + OAuth state HMAC verification + i18n parity restore close the highest-value low-effort gaps surfaced by the four parallel re-audits.

What remains gating "real" production scale is structural, not surface bugs:

1. **No async runner.** Notifications, scheduled work, and any retry semantics need a queue. This is the single highest-leverage missing piece.
2. **In-memory throttler.** Day one of HA breaks per-IP counters; combined with #1 above, the BullMQ install pays for both fixes.
3. **No persistent AI usage ledger.** A single bad-actor user against the platform AI key can be expensive.
4. **No APM / Sentry.** First production incident becomes a guessing game.
5. **Backups are local plaintext.** First lost host = lost users.

These five fixes are 4–5 engineering days. After them the app is comfortably enterprise-shaped for ≤500k MAU. Hyperscale (1M+) needs a second wave: PgBouncer, partitioning, archival, replica failover, CDN — also documented above.

### Recommended next round

Land items #1–#5 of §21 as a single "infrastructure round" (BullMQ + dispatcher + throttler-redis + AiUsageLog + Sentry — it's all one Redis dependency away). Then revisit finance-race fixes and email-verification before any public launch.

**End of Round-11 audit.**

---

## Round 12 patch — post-implementation status

The following sections are amended in light of the Round-12 infrastructure
delivery. Original §14 / §21 wording is intentionally left above for
historical context.

### §14 (amended) — Scalability + capacity, post-Round-12

| # | Bottleneck | Status after Round 12 |
|--|--|--|
| 1 | Notification dispatcher | **CLOSED** — dispatcher → notification-queue → worker → Expo provider; idempotent + quiet-hours-aware. |
| 2 | No async runner | **CLOSED** — BullMQ + 5 typed queues, retry/backoff, graceful shutdown. |
| 3 | In-memory throttler | **CLOSED** — Redis-backed storage with safe in-memory fallback; per-user tracker; `RATE_LIMITED` / `AI_RATE_LIMITED` codes; standard headers. |
| 4 | No observability | **CLOSED (foundation)** — `/metrics` (gated + bearer); structured 5xx logs with request id; `/health/ready` reports DB+Redis+queue depth. OTel SDK wiring deferred. |
| 5 | Plaintext local backups | **STILL OPEN** — P1 next round. |
| 6 | Unbounded write-only tables | **STILL OPEN** — partitioning + archival next round. |
| 7 | No connection-pool side-car | **STILL OPEN** — PgBouncer next round. |
| 8 | Single Postgres primary | **STILL OPEN** — read-replica + failover next round. |
| 9 | `pg_dump` not point-in-time | **STILL OPEN** — WAL archiving next round. |
| 10 | No CDN in front of API | **STILL OPEN** — CDN/edge next round. |

### §21 (amended) — Priority fix plan, post-Round-12

P0 list collapsed. Remaining P1 / P2 plan:

| # | Tier | Fix | Effort |
|--|--|--|--|
| 1 | P1 | Per-account login lockout (`User.failedLoginAttempts` + `lockedUntil`) | 0.5 day |
| 2 | P1 | Email verification + forgot-password (transactional email) | 1 day |
| 3 | P1 | Encrypted off-box backups (gpg + S3) | 0.5 day |
| 4 | P1 | Multi-currency aggregation (FX or reject mixed totals) | 1 day |
| 5 | P1 | Debt + SavingGoal write race fixes ($transaction wrapping) | 0.5 day |
| 6 | P1 | OTel SDK wiring (`@opentelemetry/sdk-node` + OTLP exporter) | 0.5 day |
| 7 | P1 | BullMQ Prometheus exporter (or 50-line custom poller) | 0.5 day |
| 8 | P2 | Worker-only deployment topology | 1 day |
| 9 | P2 | PgBouncer / Pgpool side-car | 1 day |
| 10 | P2 | DB partitioning + archival on hot tables | 2 days |

### Updated readiness verdict

| Tier | Verdict |
|--|--|
| Pilot (≤10k MAU) | **GO** — was already GO; notifications + queues now actually work end-to-end. |
| 100k MAU | **GO with P1 backlog** — infra is shaped. The P1 list (auth lockout, email verify, encrypted backups) is the gating bundle. |
| 500k MAU | **CONDITIONAL** — needs PgBouncer + read replica + worker-only deployment. None are large; ~3-4 dev-days. |
| 1M+ MAU | **NOT YET** — needs partitioning, archival, multi-region, CDN, load test pass. |

Million-user readiness was deliberately NOT claimed. Round 12 lifts the
ceiling from ~60-80k DAU to ~500k MAU on a single primary; passing 1M MAU
is its own program of work.

**End of Round-12 patch.**

---

## Round 13 patch — finance correctness

The 9 finance correctness items from §9 above closed (or downgraded) by
Round 13. Full report: `docs/ROUND_13_FINANCE_CORRECTNESS.md`.

| # | Round-11 item | Status |
|--|--|--|
| 1 | Debt `addPayment` race | **CLOSED** — conditional `updateMany` + `$transaction` |
| 2 | SavingGoal `contribute` race | **CLOSED** — same pattern + clamp-to-target + `appliedAmount` reconciliation |
| 3 | Multi-currency aggregation in dashboard | **CLOSED** — primary-currency-only sums + per-currency wallet map + `mixedCurrencyDetected` |
| 4 | `Number(decimal)` lossy in reports | **MITIGATED** — Decimal end-to-end via `sumMoney`/`pctOf` helpers |
| 5 | No `Idempotency-Key` middleware | **CLOSED** — header on expense/income/debt-pay/saving-contribute + `FinanceIdempotencyKey` table |
| 6 | No `AuditLog` table | **CLOSED** — `FinanceAuditLog` table + `FinanceAuditService` writing inside every write transaction |
| 7 | No soft delete on finance models | **OPEN (LOW)** — audit trail is the recovery path; soft-delete deferred to round 14 |
| 8 | Timezone bug in daily reports | **OPEN (LOW)** — documented in `docs/FINANCE_LOGIC_AUDIT.md`; round-14 fix |
| 9 | Decimal overpay tolerance on debt closeout | **CLOSED** — Decimal compare exact |

P1 backlog after Round 13:
1. Per-account login lockout
2. Email verification + forgot-password
3. Encrypted off-box backups
4. Soft delete on finance entities (round 14)
5. Timezone-aware daily report bounds (round 14)

Production readiness verdict unchanged from Round-12 patch:
- Pilot ≤10k MAU: GO
- 100k MAU: GO once #1–#3 above land
- 500k+: needs PgBouncer + read replica + worker-only deploy

**End of Round-13 patch.**

---

## Round 14 patch — auth + privacy + backup hardening

The full report is `docs/ROUND_14_AUTH_PRIVACY_HARDENING.md`.

| # | Item | Status |
|--|--|--|
| 1 | Per-account login lockout | **DONE** — 5/15min ⇒ 15min lock; SecurityAuditLog; bcrypt-timing email-enumeration defense |
| 2 | Email verification | **DONE** — `EmailVerificationToken` (sha256-hashed); 24h TTL; per-user resend throttle |
| 3 | Forgot + reset password | **DONE** — 30min TTL; reset revokes ALL refresh tokens + clears lockout; password policy enforced |
| 4 | Encrypted off-box backups | **DONE** — `backup-db-encrypted.sh` + restore counterpart; AES-256-CBC + PBKDF2 200k; optional S3 upload |
| 5 | Soft delete on finance + tasks + habits + goals | **DONE** — `deletedAt` + restore endpoints for finance entities |
| 6 | Timezone-aware daily report bounds | **DONE** — `getUserDayBounds(date, tz)` for TIMESTAMP columns; DATE-only columns keep wall-clock match |

P1 backlog after Round 14:
1. Wire SMTP transport (skeleton in place; nodemailer wiring pending)
2. WAL archiving for sub-hour RPO
3. GDPR hard-delete admin job (purge soft-deleted rows past 90 days)
4. Email-verification UI banner (i18n keys ready; renderer pending)
5. OTel SDK wiring (env hooks declared in round 12)

Production readiness verdict (post-Round 14):
- Pilot ≤10k MAU: GO
- 100k MAU: GO once SMTP transport is wired
- 500k MAU: needs PgBouncer + read replica + WAL archiving
- 1M+: same as round-13 (own program of work)

**End of Round-14 patch.**

---

## Round 17 patch — WAL archiving + SMTP nodemailer

Full report: `docs/ROUND_17_WAL_SMTP_COMPLETION.md`. The round delivers
both halves of the production-tier prerequisites flagged in earlier
rounds.

| # | Item | Status |
|--|--|--|
| 1 | WAL archive script + healthcheck | **DONE** — encrypted, idempotent, exit-code-driven |
| 2 | WAL + PITR docs | **DONE** — `docs/WAL_ARCHIVING.md` + `docs/PITR_RESTORE.md` |
| 3 | SMTP nodemailer transport | **DONE** — replaces round-14 skeleton; pool=1, redacted logs |
| 4 | EmailTemplateService (vi/en) | **DONE** — verify-email, reset-password, security-alert |
| 5 | Production env fail-fast for `EMAIL_PROVIDER=smtp` | **DONE** |
| 6 | Verification + reset wired through templates | **DONE** — never log raw token; SMTP failure doesn't 5xx |
| 7 | Physical base backup | **DEFERRED** — operator topology choice (RDS / pg_basebackup / pgBackRest) |
| 8 | Email send failure metric | **DEFERRED** — round-18 backlog |
| 9 | Multi-AZ replication | **DEFERRED** — enterprise-tier program |

Updated RPO/RTO matrix:

| Tier | RPO | RTO |
|--|--|--|
| MVP ≤10k MAU | 24 h | 60 min — ✅ ready |
| Production 10k–500k | 5 min (`archive_timeout=300s`) | 15-30 min — ⚠ needs operator-chosen base-backup tool |
| Enterprise 500k+ | 5 min | 5 min — ❌ requires multi-AZ + automated failover (own program) |

We do NOT claim enterprise readiness. Production is reachable once the
operator wires either `pg_basebackup` (self-managed) or a managed-Postgres
snapshot (RDS/Cloud SQL) on top of the WAL archiving shipped here.

Tests: 43 suites / **229 tests pass** (217 round-16 baseline + 12 new
round-17 covering EmailTemplateService + SmtpEmailProvider config
validation + redactAddress).

**End of Round-17 patch.**

---

## Round 18 patch — observability + mobile email-verify + ops references

Full report: `docs/ROUND_18_OBSERVABILITY_MOBILE_COMPLETION.md`. Closes the
round-17 backlog list (metrics exporter, OTel SDK skeleton, mobile banner,
GDPR purge, k8s manifests, pgBackRest reference) and adds the cardinality
discipline + audit-trail required for production observability.

| # | Item | Status |
|--|--|--|
| 1 | Email metrics (send/failure/latency/template render) | **DONE** |
| 2 | WAL/backup age gauges + textfile exporter | **DONE** |
| 3 | Marker writes from cron-driven backup + WAL scripts | **DONE** |
| 4 | AI quota refusal counter | **DONE** |
| 5 | Live queue depth gauge (registered; live setter round-19) | **PARTIAL** |
| 6 | OTel SDK skeleton (env-gated + runtime-optional + header redaction) | **DONE** |
| 7 | GDPR purge admin endpoint (dry-run, confirmation, audit, no self-purge, no admin-target) | **DONE** |
| 8 | Mobile email-verify banner on Dashboard (vi/en) | **DONE** |
| 9 | K8s reference manifests (api + 4 workers + service + HPA + cron + cm + secret) | **DONE** (reference only) |
| 10 | pgBackRest reference setup | **DONE** (reference only) |

Tests: 46 suites / **246 tests pass** (229 round-17 baseline + 17 new
round-18 covering DataPurge + MetricsRegistry + classifyEmailFailure +
maybeStartOtel).

Cardinality discipline (no userId / email / token / API key on any label)
audited and documented in the completion doc.

Readiness: **unchanged from Round 17** — production-tier RPO of 5 min is
still gated on operator base-backup tool choice; enterprise tier still
requires multi-AZ replication. Round 18 makes the operations + observability
posture production-grade for the **MVP and pilot tiers**, and lays the
foundation pgBackRest + SMTP credentials need to lift production-tier.

**End of Round-18 patch.**
