# AI Personal Life Planner

Mobile app + AI backend that helps people plan their day: what to do, when to wake/sleep, when to eat, when to focus, and what to adjust when life slips off-plan.

This repository is a **monorepo** containing the mobile app, the API, and a shared package for cross-cutting types and validation.

> **Status:** foundation only. The structure, auth, database, and AI proxy boundary are wired up. Business modules (tasks, habits, schedule, daily planning, reports, push) are scaffolded as empty modules and will land in subsequent iterations.

---

## Repository layout

```
.
├── apps/
│   ├── api/         # NestJS + Prisma + PostgreSQL backend
│   └── mobile/      # React Native + Expo app
├── packages/
│   └── shared/      # Shared TypeScript types + Zod schemas
├── docker/          # docker-compose for local Postgres
├── docs/            # Architecture and design notes
├── scripts/         # One-shot helper scripts (setup, check)
├── .env.example     # Root env example
└── package.json     # npm workspaces
```

---

## Stack

| Layer    | Tech |
| -------- | ---- |
| Mobile   | React Native + Expo + TypeScript |
| Backend  | NestJS + TypeScript |
| Database | PostgreSQL 16 |
| ORM      | Prisma |
| Auth     | JWT access + refresh tokens (refresh tokens stored hashed) |
| Validation | Zod (shared between mobile & API) |
| AI       | Server-side only — mobile never holds the provider key |
| Container| Docker (Postgres locally; Dockerfile provided for the API) |

---

## Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **npm 10+** (workspaces)
- **Docker Desktop** (for local Postgres) — or a local Postgres if you prefer
- **Expo Go** app on your phone, or Android Studio / Xcode for emulators

---

## First-time setup

```bash
# 1. Copy env templates (or run the helper script below)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp docker/.env.example docker/.env

# 2. Install dependencies (npm workspaces installs everything)
npm install

# 3. Start Postgres
npm run dev:db

# 4. Generate Prisma client and run the first migration
npm run --workspace @planner/api db:generate
npm run --workspace @planner/api db:migrate -- --name init

# 5. (Optional) seed a demo user
npm run db:seed
```

Or, on a Unix shell:
```bash
bash scripts/setup.sh
```

On Windows PowerShell:
```powershell
pwsh scripts/setup.ps1
```

> **Important:** edit `apps/api/.env` and replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with strong random values (`openssl rand -hex 64`). The API refuses to boot with the placeholder values because they are shorter than 32 chars only by mistake.

---

## Running locally

Two terminals:

```bash
# Terminal 1 — backend
npm run dev:api
# → http://localhost:3000/api/health

# Terminal 2 — mobile
npm run dev:mobile
# → press `a` for Android emulator, `i` for iOS simulator, or scan QR with Expo Go
```

> If your phone can't reach `localhost`, set `EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-ip>:3000/api` in `apps/mobile/.env`.

---

## Available root scripts

| Command | What it does |
| --- | --- |
| `npm run dev:api` | Start the NestJS API in watch mode |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run dev:db` | Start Postgres via docker compose |
| `npm run dev:db:down` | Stop Postgres |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio in the browser |
| `npm run build` | Build shared package + API |
| `npm run lint` | Lint every workspace that defines a `lint` script |
| `npm run typecheck` | TypeScript noEmit check across every workspace |
| `npm test` | Run tests across every workspace |
| `npm run format` | Prettier format the whole repo |

---

## Building production bundles for mobile

```bash
# Install EAS CLI once
npm i -g eas-cli
eas login

# From apps/mobile/
eas build --platform android --profile preview     # internal APK
eas build --platform android --profile production  # AAB for Play Store
eas build --platform ios     --profile production  # IPA for App Store
```

`apps/mobile/eas.json` defines the build profiles. For local-only Android APKs, run `expo prebuild` then build through Android Studio.

---

## Why AI calls live behind the API

The mobile app **never** holds an AI provider key. All AI traffic flows through `POST /api/ai/*`, where the API:

- holds the provider key (server-side env)
- enforces auth, throttling, and audit logging
- can later add caching, prompt versioning, and provider failover without re-shipping the app

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.

---

## Security defaults

- Passwords hashed with bcrypt (cost 10).
- Refresh tokens stored as SHA-256 hashes; `/auth/refresh` rotates and revokes the previous one.
- Helmet enabled, CORS configurable per env, global rate limiter via `@nestjs/throttler`.
- Env vars validated with Zod at boot — the API refuses to start with weak/missing JWT secrets.
- No secrets in source. `.env*` files are gitignored; only `.env.example` is checked in.

---

## What's next

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned feature modules.
