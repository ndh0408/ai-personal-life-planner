# Round 12 — P0 Infrastructure Completion

**Date:** 2026-04-25
**Goal:** close the 5 P0 infrastructure blockers identified by the Round-11
enterprise audit so LifeOS AI can ship past pilot scale (≥10k MAU) without
re-architecture.

## Summary

| # | P0 blocker | Status | Notes |
|--|--|--|--|
| 1 | Notification dispatcher | **DONE** | Dispatcher → queue → worker → Expo provider. Idempotent, quiet-hours-aware, locale-aware, deactivates invalid tokens. |
| 2 | BullMQ async runner | **DONE** | 5 typed queues, shared Redis client, retry/backoff defaults, graceful shutdown, no-op safe when `QUEUE_ENABLED=false`. |
| 3 | Redis-backed throttler | **DONE** | Hand-rolled storage on top of shared Redis client; safe in-memory fallback when Redis disabled or unhealthy; per-user tracker for authenticated routes; `RATE_LIMITED` / `AI_RATE_LIMITED` error codes; standard headers. |
| 4 | AI usage ledger + quota | **DONE** | `AiUsageLog` + `AiUsageQuota` Prisma models; quota check + log integrated into `AiProviderService.complete`; 2 endpoints; admin bypass; timezone-aware reset; never stores prompt/response. |
| 5 | APM / observability | **DONE (foundation)** | Prometheus `/metrics` (gated + bearer), 5xx structured logs with request id (Round 11), `/health/ready` reports DB+Redis+queue depth, OTel env hooks declared but SDK wiring intentionally left to v1.4 once exporter target is selected. |

## Quality gate

- `npm run typecheck` (api) — **clean**
- `npm test` (api) — **35 suites / 167 tests, all green** (151 baseline + 16 new)
- 1 Prisma migration: `20260425120000_add_ai_usage_and_notification_dedupe` — applied to local dev DB.
- Mobile typecheck — not required this round (no shared schema fields touched on the mobile side; backend-only infra).

## Files changed (summary)

### New files (Round 12)

```
apps/api/prisma/migrations/20260425120000_add_ai_usage_and_notification_dedupe/migration.sql

apps/api/src/modules/queue/
  queue.constants.ts
  redis.service.ts
  queue.service.ts
  queue.module.ts
  redis-throttler.storage.ts
  redis-throttler.storage.spec.ts

apps/api/src/modules/notifications/
  expo-notification.provider.ts
  notification-template.service.ts
  notification-dispatcher.service.ts
  notification-worker.service.ts
  notification-dispatcher.service.spec.ts
  notification-worker.service.spec.ts

apps/api/src/modules/ai-usage/
  ai-usage.constants.ts
  ai-usage.service.ts
  ai-usage.service.spec.ts
  ai-usage.controller.ts
  ai-usage.module.ts

apps/api/src/modules/observability/
  metrics.registry.ts
  metrics.interceptor.ts
  metrics.controller.ts
  observability.module.ts

apps/api/src/common/guards/user-aware-throttler.guard.ts

docs/QUEUE_WORKERS.md
docs/NOTIFICATION_DISPATCHER.md
docs/RATE_LIMITING.md
docs/AI_USAGE_LEDGER.md
docs/AI_USAGE_LIMITS.md
docs/OBSERVABILITY.md
docs/PRODUCTION_DASHBOARDS.md
docs/ROUND_12_INFRA_P0_COMPLETION.md   (this file)
```

### Modified files (Round 12)

```
apps/api/prisma/schema.prisma
  + idempotencyKey + attempts on NotificationLog (unique on userId,key)
  + AiUsageLog + AiUsageQuota models, AiUsagePlan + AiFeature enums
  + relations on User

apps/api/src/config/env.validation.ts
  + QUEUE_ENABLED, REDIS_URL, WORKER_CONCURRENCY_*,
    METRICS_ENABLED/PATH/BEARER_TOKEN, LOG_LEVEL, OTEL_*
  + production-only superRefine: REDIS_URL required when QUEUE_ENABLED=true,
    OTEL endpoint required when OTEL_ENABLED=true

apps/api/src/app.module.ts
  + ThrottlerModule.forRootAsync uses RedisThrottlerStorage
  + UserAwareThrottlerGuard replaces ThrottlerGuard
  + MetricsInterceptor wired as APP_INTERCEPTOR
  + QueueModule, ObservabilityModule, AiUsageModule (global)

apps/api/src/modules/ai/services/ai-provider.service.ts
  + AiUsageContext optional arg on .complete()
  + assertWithinQuota → on entry; log success/failure on every path

apps/api/src/modules/ai/services/test-helpers.ts
  + makeStubUsage() no-op AiUsageService for unit tests

apps/api/src/modules/notifications/notifications.module.ts
  + provides + exports dispatcher, template, provider, worker

apps/api/src/modules/health/health.controller.ts
  + /health/ready reports DB + Redis + queue depth

(spec test constructors updated to pass makeStubUsage() — 6 files)

apps/api/package.json
  + bullmq, ioredis, prom-client
```

## How to run queues / workers

### Local dev (queue layer optional)

Default: queue disabled, throttler in-memory, workers don't start, dispatcher
returns log id but skips the queue.

```bash
npm --workspace apps/api run start:dev
```

### Local dev with the full pipeline

```bash
docker run --rm -d -p 6379:6379 redis:7-alpine
QUEUE_ENABLED=true REDIS_URL=redis://localhost:6379 \
EXPO_PUSH_DRY_RUN=true \
npm --workspace apps/api run start:dev
```

### Production

Required env (validated at boot):

```
QUEUE_ENABLED=true
REDIS_URL=redis://prod-redis:6379          # or rediss:// for TLS
WORKER_CONCURRENCY_NOTIFICATION=5
WORKER_CONCURRENCY_AI=2
WORKER_CONCURRENCY_REPORT=2

METRICS_ENABLED=true
METRICS_BEARER_TOKEN=<long random>          # required if /metrics is reachable
LOG_LEVEL=log

# Optional — enables OTel env gate (SDK wiring still pending)
OTEL_ENABLED=false
```

The current build runs queues + workers in-process with the API. Scale by
adding API replicas — BullMQ atomic Redis claims distribute the load. For
worker-only deployments (CPU isolation), boot the same image without
`app.listen()` — future work.

### Migrations

```
npx prisma migrate deploy
```

## Required env vars (full list)

| Var | Purpose | Default |
|--|--|--|
| `QUEUE_ENABLED` | turn the queue layer on/off | `false` |
| `REDIS_URL` | shared Redis | (required when QUEUE_ENABLED=true in prod) |
| `WORKER_CONCURRENCY_NOTIFICATION` | per-replica notif workers | `5` |
| `WORKER_CONCURRENCY_AI` | per-replica AI workers | `2` |
| `WORKER_CONCURRENCY_REPORT` | per-replica report workers | `2` |
| `METRICS_ENABLED` | expose `/metrics` | `false` |
| `METRICS_PATH` | scrape path | `/metrics` |
| `METRICS_BEARER_TOKEN` | optional bearer for `/metrics` | (none) |
| `LOG_LEVEL` | `error \| warn \| log \| debug \| verbose` | `log` |
| `OTEL_ENABLED` | future OTel SDK wiring | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | required when OTEL_ENABLED=true | (none) |
| `EXPO_PUSH_DRY_RUN` | no-op the push provider (dev/test) | `false` |

## Remaining risks (not closed in Round 12)

- **Native worker container.** Today queues run in-process with the API.
  Adequate up to ~500k MAU. For higher load split into a worker-only
  deployment (1 day of work — same code, different boot flag).
- **OTel SDK.** Env gate exists; the actual `@opentelemetry/sdk-node`
  wiring is intentionally deferred until the exporter target is chosen.
- **BullMQ exporter.** Queue depths are visible at `/health/ready` but no
  Prometheus scrape exporter is wired. Add `bull-exporter` or a 50-line
  custom poller.
- **Encrypted off-box backups.** Still P1 — `scripts/backup-db.sh` writes
  plaintext locally.
- **PgBouncer / partitioning / replicas / multi-region.** Unchanged from
  the Round-11 audit — these gate million-MAU scale, not 100k.

## Verification snippet

```bash
cd apps/api
npm run typecheck
npm test -- --silent | tail -5
# Test Suites: 35 passed, 35 total
# Tests:       167 passed, 167 total
```
