# Rate Limiting

Round 12 swapped the in-memory throttler storage for a Redis-backed one with
a safe fallback, plus added per-user tracking for authenticated requests.

## Algorithm

Fixed-window counter using Redis `INCR` + `EXPIRE`. When the counter exceeds
the limit inside the window, a parallel `…:blocked` key is set with the
configured `blockDuration`; further requests are short-circuited until the
block expires.

## Storage

`apps/api/src/modules/queue/redis-throttler.storage.ts` implements the
`@nestjs/throttler` `ThrottlerStorage` interface. Behaviour:

- `QUEUE_ENABLED=false` (default local/test) → falls through to the
  built-in `ThrottlerStorageService` (in-memory).
- Redis enabled but unhealthy → degrades to in-memory for that request.
- Any Redis error during `increment()` → degrades to in-memory.

This means a Redis outage **degrades** rate-limiting (counters become
per-pod) instead of 5xx-ing the user.

## Tracker key (per-user)

`UserAwareThrottlerGuard` (apps/api/src/common/guards/user-aware-throttler.guard.ts)
overrides `getTracker()`:

- Authenticated request (`req.user.id` set by `JwtAuthGuard`)
  → `u:${userId}` (per-user, consistent across IPs)
- Unauthenticated → `ip:${req.ip}` (per-IP, used by /auth/* endpoints)

## Error envelope

When the throttler fires, the guard throws an HttpException with:

```json
{
  "success": false,
  "data": null,
  "message": "Too many requests",
  "errorCode": "RATE_LIMITED",
  "statusCode": 429,
  ...
}
```

For routes under `/api/ai` the code is `AI_RATE_LIMITED` so the mobile
client can branch to the AI-specific UI.

Headers set on the 429:

- `Retry-After: <seconds>`
- `X-RateLimit-Limit: <limit>`
- `X-RateLimit-Remaining: 0`

## Per-route limits

Routes use the `@Throttle({ default: { limit, ttl } })` decorator from
`@nestjs/throttler` exactly as before. Existing per-route limits are preserved:

- `auth/login` 10/min
- `auth/refresh` 10/min
- `ai/*` 12/min
- `connected-accounts/*/start` + `*/callback` 10/min
- Default: 120 / 60s (env `THROTTLE_TTL`, `THROTTLE_LIMIT`)

## Fallback semantics

| Scenario | Result |
|--|--|
| QUEUE_ENABLED=false | per-pod in-memory limit |
| Redis healthy | per-cluster Redis limit |
| Redis unhealthy | degraded per-pod limit (warn-log only) |
| Production with QUEUE_ENABLED=true but REDIS_URL missing | **boot fails** (env validation) |

## Tests

`redis-throttler.storage.spec.ts`:
- in-memory fallback works when Redis disabled
- per-key isolation (different users / IPs don't collide)
