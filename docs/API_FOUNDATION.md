# LifeOS AI — API Foundation

This file documents the *invariant scaffolding* of `apps/api`: things that
every controller and module is expected to depend on. Endpoint shape per
feature lives in [API_CONTRACT.md](./API_CONTRACT.md); this is the chassis
underneath.

## Wire format

Every JSON response — success or failure — uses the same envelope:

```ts
// Success
{ "success": true,  "data": { ... }, "errorCode": null,         "message": "OK" }

// Error
{ "success": false, "data": null,    "errorCode": "BAD_REQUEST", "message": "...", "requestId": "abc123" }
```

- `data` is the payload. Controllers can return any value; the
  `ResponseEnvelopeInterceptor` wraps it. If a controller already returns an
  envelope-shaped object, the interceptor leaves it alone.
- `errorCode` is a stable, screaming-snake-case identifier. Mobile clients
  switch on this, not on `message`. A non-exhaustive catalog:

  | HTTP status | Default `errorCode` |
  |---|---|
  | 400 | `BAD_REQUEST`, or specific (e.g. `validation_failed`) |
  | 401 | `UNAUTHENTICATED`, `invalid_token`, `missing_token` |
  | 403 | `FORBIDDEN` |
  | 404 | `NOT_FOUND` |
  | 409 | `CONFLICT` |
  | 422 | `UNPROCESSABLE` |
  | 429 | `RATE_LIMITED` |
  | 500 | `INTERNAL_ERROR` |
  | 502 | `UPSTREAM_ERROR` |
  | 503 | `UNAVAILABLE` |

  Throwing `new HttpException({ error: { code: 'invalid_credentials', message: 'Email or password is incorrect' } }, 401)`
  yields `errorCode: 'invalid_credentials'`.

- `requestId` is set on every error (and exposed via the `x-request-id`
  response header on every request). Use it when reporting bugs — it is the
  correlation key for server logs.

## Configuration

`src/config/env.schema.ts` declares a Zod schema for every env var. The
`ConfigModule` calls `validateEnv` at boot. **Production refuses to start
with a missing or malformed secret.** A boot failure prints which keys are
broken and exits non-zero.

| Var | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | one of `development`, `test`, `production` |
| `PORT` | no | `4000` | |
| `DATABASE_URL` | **yes** | — | postgres URL |
| `REDIS_URL` | **yes** | — | `redis://...` |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | **yes** | — | ≥ 32 chars, different from access |
| `JWT_ACCESS_TTL` | no | `15m` | |
| `JWT_REFRESH_TTL` | no | `30d` | |
| `USER_AI_KEY_ENCRYPTION_KEY` | **yes** | — | exactly 64 hex chars (32-byte AES-256-GCM key) |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | |
| `OPENAI_DEFAULT_MODEL` | no | `gpt-4o-mini` | |
| `CORS_ORIGINS` | no | `""` | comma-separated exact origins |
| `THROTTLE_TTL` | no | `60` | seconds |
| `THROTTLE_LIMIT` | no | `100` | per `THROTTLE_TTL` |
| `SWAGGER_ENABLED` | no | `false` | only honoured when `NODE_ENV !== production` |

Generate strong values:
```bash
openssl rand -base64 48   # JWT secrets
openssl rand -hex 32      # USER_AI_KEY_ENCRYPTION_KEY
```

`config.printer.ts:redactEnvForLogging` is the only safe path to log env
state. It replaces every secret with `[set, N chars]`. Never `console.log`
the raw `Env`.

## Cross-cutting infrastructure

| Concern | Where it lives | What it does |
|---|---|---|
| Request ID | `common/http/request-id.middleware.ts` | Pulls `x-request-id` from the request or mints a 12-char nanoid; sets it back on the response. |
| Helmet | wired in `main.ts` | Adds standard security headers (no CSP in dev so Swagger UI works). |
| CORS | `main.ts`, `CORS_ORIGINS` env | Exact origins only. Empty list = blocked. `x-request-id` is exposed. |
| Rate limit | `@nestjs/throttler` global guard | `THROTTLE_LIMIT` requests per `THROTTLE_TTL` seconds. Per-IP for unauth, per-user once auth lands. |
| Validation | `common/pipes/zod-validation.pipe.ts` + global `ValidationPipe` | Body schemas come from `@lifeos/shared` Zod schemas. Controllers do not parse raw bodies. |
| Auth | `common/guards/jwt-auth.guard.ts` + `@Public()` decorator | Foundation only — full module wiring lands in round 1. |
| Encryption | `common/crypto/encryption.service.ts` | AES-256-GCM seal/open for the user's OpenAI key. Boots only with a valid 32-byte key. |
| Response envelope | `common/http/response.interceptor.ts` | Wraps every success in the standard envelope. |
| Error envelope | `common/http/all-exceptions.filter.ts` | Maps `HttpException` and unknown errors to the envelope; in production, 5xx messages are reduced to "Internal server error". Stack traces are never sent to the client. |

## Module map

Foundation registers every domain module as an empty `@Module({})`. Each
round fills in controllers/providers without touching `app.module.ts`.

```
ConfigModule          ✓ env validation
PrismaModule          ✓ Prisma client (global)
RedisModule           ✓ ioredis singleton (global)
EncryptionModule      ✓ AES-256-GCM (global)

AuthModule            stub — round 1
UsersModule           stub — round 1
UserProfileModule     stub — round 1
UserAiKeyModule       stub — round 1

TasksModule           stub — round 3
FinanceModule         stub — round 3
MealsModule           stub — round 3
SleepMoodModule       stub — round 3
PlannerModule         stub — round 4
AssistantModule       stub — round 4
AiModule              stub — round 2 (capture parser); used by Assistant later
NotificationsModule   stub — round 5
PrivacyModule         stub — round 5
```

## Endpoints in the foundation

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/api/health` | public | — | `{ service, version, db, redis, uptimeSec, timestamp }` |
| GET | `/api/version` | public | — | `{ service, version, startedAt, node, env }` |

Both are wrapped in the standard success envelope, e.g.:

```json
{
  "success": true,
  "data": {
    "service": "lifeos-api",
    "version": "0.1.0",
    "db": "ok",
    "redis": "ok",
    "uptimeSec": 12,
    "timestamp": "2026-04-26T13:42:00.000Z"
  },
  "errorCode": null,
  "message": "OK"
}
```

## Logging discipline

- Logger is Nest's built-in for now (round 0). Swap for `pino` in round 1.
- Format: `[<context>] <level>: <message>`. JSON output in production
  (planned).
- Never log: raw env, password fields, refresh tokens, OpenAI keys,
  bcrypt hashes, ciphertext blobs. The redactor in `config.printer.ts` is
  the only sanctioned path that touches env.
- Every 5xx logs at `error` with the request id; 4xx at `warn`.

## Swagger

Disabled by default. Set `SWAGGER_ENABLED=true` in dev to mount
`http://localhost:4000/api/docs`. Production ignores the flag — Swagger is
never exposed there.

## Smoke test

After boot:

```bash
curl -s http://localhost:4000/api/health | jq
curl -s http://localhost:4000/api/version | jq
```

Both should return `{ "success": true, ... }` envelopes. The `x-request-id`
header is present on every response; pass it back as `x-request-id: <id>`
to keep the same id (for client-driven tracing).
