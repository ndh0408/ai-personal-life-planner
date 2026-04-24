# API setup — LifeOS AI backend

NestJS + Prisma + PostgreSQL. This doc covers local setup, environment variables, and how to exercise the foundation endpoints.

## Prerequisites

- Node 20+, npm 10+
- Docker Desktop (for local Postgres) — or a local Postgres on port 5440
- Optional: Prisma Studio for inspecting the DB (`npm run db:studio`)

## Environment variables

Copy `apps/api/.env.example` → `apps/api/.env`, then fill:

| Key | Purpose | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` \| `production` \| `test` | Prod hides internal 5xx messages |
| `PORT` | HTTP port | Default 3000 |
| `DATABASE_URL` | Postgres connection string | `postgresql://planner:planner_dev_password@localhost:5440/planner?schema=public` matches `docker/docker-compose.yml` |
| `JWT_ACCESS_SECRET` | Access-token signing key | **≥ 32 chars**. Generate with `openssl rand -hex 64` |
| `JWT_ACCESS_EXPIRES_IN` | Access TTL | Default `15m` |
| `JWT_REFRESH_SECRET` | Refresh-token signing key | **≥ 32 chars**, different from access secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh TTL | Default `30d` |
| `CORS_ORIGIN` | Comma-separated origins | `*` only in dev |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Global rate limit | Default 120 req / 60s |
| `DEFAULT_LOCALE` | Fallback locale | Default `vi` |
| `AI_PROVIDER` | `anthropic` \| `openai` \| `mock` | `mock` for local |
| `AI_API_KEY` | Provider key | Server-side only. Never ship to mobile. |
| `AI_MODEL` | Model slug | e.g. `claude-sonnet-4-6` |

Env is validated with Zod at boot (`apps/api/src/config/env.validation.ts`). The API **refuses to start** with missing or too-short secrets.

## First-time setup

```bash
# 1. From the repo root — installs all workspaces
npm install

# 2. Start Postgres
npm run dev:db

# 3. Generate Prisma client + apply migrations
npx --workspace apps/api prisma generate
npm run --workspace apps/api db:migrate:deploy

# 4. (Optional) seed demo data
npm run db:seed

# 5. Run the API
npm run dev:api
# → http://localhost:3000/api/health
```

Seed account (only if you ran step 4):
```
email:    demo@planner.local
password: demo1234
```

## Foundation endpoints

All non-auth endpoints require `Authorization: Bearer <accessToken>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/health/ready` | Liveness + DB ping |
| `POST` | `/api/auth/register` | `{ email, password, name?, timezone? }` → `{ accessToken, refreshToken, expiresIn }` |
| `POST` | `/api/auth/login` | `{ email, password }` → tokens |
| `POST` | `/api/auth/refresh` | `{ refreshToken }` → rotated tokens |
| `POST` | `/api/auth/logout` | Revokes all refresh tokens for the caller |
| `GET` | `/api/me` | Returns the signed-in user + embedded profile (no password hash) |
| `GET` | `/api/users/me` | Alias — same payload as `/api/me` |

Feature endpoints live under `/api/tasks`, `/api/habits`, `/api/schedules`, `/api/meals`, `/api/sleep-logs`, `/api/mood-logs`, `/api/profile`, `/api/planner/today`, `/api/reports/daily|weekly`, `/api/notifications/*`, `/api/ai/*`, and the scaffolds `/api/finance/overview`, `/api/goals`.

See [API_REFERENCE.md](./API_REFERENCE.md) for the full payload / query shapes.

## Response envelope

Success:
```json
{ "success": true, "data": <payload>, "message": "OK" }
```

Error:
```json
{
  "success": false,
  "errorCode": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid credentials",
  "statusCode": 401,
  "path": "/api/auth/login",
  "timestamp": "2026-04-24T07:30:00.000Z"
}
```

Mobile clients **must** branch on `errorCode`, not `message`. See [AUTH_FLOW.md](./AUTH_FLOW.md) for the full error-code catalog.

## Testing the auth flow

```bash
# Register
curl -sX POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeMe123!","name":"Alice"}'

# Login (stash the tokens from the response into $ACCESS / $REFRESH)
curl -sX POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeMe123!"}'

# Call a protected route
curl -s http://localhost:3000/api/me \
  -H "Authorization: Bearer $ACCESS"

# Refresh
curl -sX POST http://localhost:3000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"

# Logout
curl -sX POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $ACCESS" \
  -w '%{http_code}\n'   # 204
```

## Ports

- API: **3000** (override via `PORT`)
- Postgres: **5440** (override via `POSTGRES_PORT` in `docker/.env`)

Postgres uses 5440 to avoid collision with a local Postgres on 5432.

## Security defaults

- Bcrypt cost 10 for password hashes.
- Refresh tokens stored as SHA-256 hashes. `/auth/refresh` rotates the token and marks the previous one revoked.
- Helmet enabled. CORS from env. Global throttle + tighter limits on `/auth/*` (5 registers / 10 logins / 30 refreshes per minute per IP).
- Validation via Zod (shared with mobile through `@planner/shared`).
- Production mode (`NODE_ENV=production`) hides raw 5xx messages from the response body — only the `errorCode` and a generic message are returned. The full error is logged server-side with stack.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid environment variables: JWT_ACCESS_SECRET must be at least 32 chars` | Replace the placeholder in `.env` with `openssl rand -hex 64` |
| `ECONNREFUSED 5440` | Run `npm run dev:db` |
| `Prisma client is not configured` | Run `npx --workspace apps/api prisma generate` |
| Mobile gets `NETWORK` errors | API isn't reachable from the device — use your LAN IP in `EXPO_PUBLIC_API_BASE_URL` |
