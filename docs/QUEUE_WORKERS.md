# Queue + Workers

Round 12 introduced an async work runner for LifeOS AI. This doc covers what
is in the queue layer, how to enable it locally, and how to operate it in
production.

## Stack

- **Redis** (any 6.x+ instance) — message broker.
- **BullMQ** — typed job queues + workers on top of ioredis.
- One shared `RedisService` connection (apps/api/src/modules/queue/redis.service.ts)
  owned by `QueueService`. Every queue + worker reuses it.

## Queues

Defined in `apps/api/src/modules/queue/queue.constants.ts`.

| Queue | Purpose | Worker concurrency env |
|--|--|--|
| `notification-queue` | Drains `NotificationLog` PENDING rows → push provider | `WORKER_CONCURRENCY_NOTIFICATION` |
| `ai-queue` | Long-running AI background jobs (rebuild user context, batch summaries) | `WORKER_CONCURRENCY_AI` |
| `report-queue` | Precompute daily/weekly review snapshots | `WORKER_CONCURRENCY_REPORT` |
| `assistant-monitoring-queue` | Proactive nudge sweep + assistant monitor | (uses notification concurrency) |
| `finance-snapshot-queue` | Daily finance snapshot persistence | (uses report concurrency) |

Default job options applied by `QueueService`:

- `attempts: 5`
- `backoff: { type: 'exponential', delay: 5000ms }`
- `removeOnComplete: { age: 24h, count: 1000 }`
- `removeOnFail: { age: 7d, count: 5000 }`

### Idempotency

Most enqueues set `jobId` deterministically (e.g. notification dispatch uses
`send-${notificationLogId}`). BullMQ refuses to enqueue a duplicate jobId
inside the queue, so retries don't fan out into N copies of the same work.

## Local development

The queue layer is **disabled by default** so a fresh clone runs without
Redis. With `QUEUE_ENABLED=false`:

- `QueueService.enqueue()` returns `null`.
- Workers don't start.
- `RedisThrottlerStorage` falls through to the in-memory throttler.
- `/health/ready` reports `redis: 'disabled'` and `queues: null`.

To exercise the real path locally:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
QUEUE_ENABLED=true REDIS_URL=redis://localhost:6379 npm --workspace apps/api run start:dev
```

## Production

Required env (validated by `env.validation.ts` in production):

- `QUEUE_ENABLED=true`
- `REDIS_URL=redis://…` (or `rediss://` for TLS)
- `WORKER_CONCURRENCY_NOTIFICATION` (default 5)
- `WORKER_CONCURRENCY_AI` (default 2)
- `WORKER_CONCURRENCY_REPORT` (default 2)

### Deployment topology

The current build runs queues **in-process** with the API — every API replica
also runs the workers, sharing the load via BullMQ's atomic Redis claims.
This keeps deployment to one container type and is appropriate for ≤500k MAU.

For higher load or noisy-neighbour isolation, the same code can boot as a
worker-only container (no `app.listen()`). Future work.

### Graceful shutdown

`RedisService` and `QueueService` register `OnApplicationShutdown` hooks; the
`NotificationWorkerService` does the same. SIGTERM:

1. Stops accepting new HTTP requests (Nest enables this in main.ts).
2. Worker calls `worker.close()` — finishes the in-flight job before exit.
3. Queue clients call `queue.close()`.
4. Redis client calls `quit()`.

This drains in-flight work without losing it.

## Health snapshot

`GET /health/ready` returns:

```json
{
  "status": "ready",
  "database": "up",
  "redis": "up",
  "queues": {
    "notification-queue": { "waiting": 0, "active": 1, "failed": 2 },
    ...
  }
}
```

## Adding a new queue

1. Add the name + jobs to `queue.constants.ts`.
2. Inject `QueueService` and call `enqueue(QUEUE_NAMES.X, JOBS.Y, payload, opts)`.
3. Add a worker service that mirrors `NotificationWorkerService` (BullMQ
   `Worker` + `OnModuleInit`/`OnApplicationShutdown`).
4. Pick a sensible concurrency env var.
