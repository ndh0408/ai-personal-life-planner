# LifeOS AI

A proactive, 24/7 personal life OS. Mobile-first. One input box, smart
defaults, no forms unless you ask for them. Built as a clean rewrite after
the previous deployment was wiped on 2026-04-26.

> Curious about the *why*? Start with [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md)
> and [docs/UX_PRINCIPLES.md](./docs/UX_PRINCIPLES.md).

## Stack

| | |
|---|---|
| Mobile | Expo SDK 51 + React Native 0.74 + TypeScript |
| API | NestJS 10 + Prisma 5 + Postgres 16 |
| Queue | BullMQ on Redis 7 |
| Auth | JWT access (15m) + rotating refresh (30d, hashed) |
| AI | OpenAI, proxied through API; key encrypted at rest with AES-256-GCM |
| i18n | i18next, vi + en |
| Tooling | npm workspaces, Prettier, ESLint, Docker Compose |

## Repo layout

```
apps/
  api/        NestJS backend
  mobile/     Expo React Native app
packages/
  shared/     Zod schemas + TS types (api ↔ mobile)
docs/         Product, architecture, UX, security, contracts, roadmap
docker/       Reserved for production compose / helper Dockerfiles
scripts/      Dev helpers (bootstrap, env guards)
```

## Run it locally

Prereqs:
- Node 20.12+ (`nvm use` picks up `.nvmrc`)
- Docker (for Postgres + Redis)

```bash
# 1. Clone and copy env templates
git clone <repo>
cd lifeos-ai
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 2. Install workspace deps
npm install

# 3. Start Postgres + Redis
npm run dev:db

# 4. Apply DB schema
npm run db:migrate:dev   # first run will prompt for a migration name

# 5. Start API and mobile in parallel
npm run dev
```

API: <http://localhost:4000/api/health>
Mobile: open Expo Go (or simulator) on the LAN URL printed by `expo start`.

Or, for a one-shot bootstrap on a fresh checkout:

```bash
bash scripts/dev-bootstrap.sh
```

## Common scripts

| Script | What it does |
|---|---|
| `npm run dev` | API + Expo together (concurrently) |
| `npm run dev:api` | NestJS in watch mode |
| `npm run dev:mobile` | Expo dev server |
| `npm run dev:db` | Start Postgres + Redis containers |
| `npm run dev:db:down` | Stop them |
| `npm run db:migrate:dev` | Prisma `migrate dev` |
| `npm run db:migrate` | Prisma `migrate deploy` (production) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | `tsc --noEmit` across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Run Jest where present |
| `npm run format` | Prettier write |

## Environment variables

| File | Purpose |
|---|---|
| `.env` | Shared by docker-compose (Postgres user/pw, ports) |
| `apps/api/.env` | API runtime (DB URL, JWT secrets, encryption key, CORS) |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` only (anything else stays server-side) |

Generate strong secrets:
```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

**Never commit a `.env`.** Only `.env.example` files are tracked. There's a
`scripts/check-env.sh` guard you can wire into git hooks if you want the safety net.

## Documentation

| Doc | What's in it |
|---|---|
| [PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | What we're building, for whom, what we explicitly are *not* building |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Big-picture diagrams, request lifecycle, tech rationale |
| [UX_PRINCIPLES.md](./docs/UX_PRINCIPLES.md) | The ten rules every screen has to pass |
| [API_CONTRACT.md](./docs/API_CONTRACT.md) | REST endpoints + Zod schemas |
| [MOBILE_DESIGN_SYSTEM.md](./docs/MOBILE_DESIGN_SYSTEM.md) | Palette, type, components, motion |
| [SECURITY_PRIVACY.md](./docs/SECURITY_PRIVACY.md) | Threat model, secrets handling, privacy posture |
| [REBUILD_ROADMAP.md](./docs/REBUILD_ROADMAP.md) | Round-by-round path back to MVP |

## Status

Round 0 (foundation) complete. Round 1 (Auth + AI key) is next —
see the [roadmap](./docs/REBUILD_ROADMAP.md).
