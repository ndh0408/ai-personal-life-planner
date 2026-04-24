# @planner/api

NestJS + Prisma + PostgreSQL backend for the AI Personal Life Planner.

## Quick start

1. Start PostgreSQL: `npm run dev:db` from the repo root.
2. Copy `.env.example` to `.env` and fill in secrets.
3. From the repo root: `npm install` (workspaces install everything).
4. `npm run db:migrate --workspace @planner/api` (first run creates the schema).
5. `npm run dev:api` from the repo root starts the API on port 3000.

## Endpoints (current foundation)

- `GET  /api/health` — liveness ping
- `GET  /api/health/ready` — readiness, checks DB
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (requires Bearer token)
- `GET  /api/users/me` (requires Bearer token)
- `POST /api/ai/chat` (requires Bearer token)

Business modules (tasks, habits, schedule, daily plan, weekly report, push) are wired as
empty modules and will be implemented in subsequent iterations.

## Why AI calls live on the server

The mobile app never holds the AI provider key. All AI traffic flows through
`/api/ai/*` so we keep the key server-side and centralize rate limiting,
auditing, and caching.
