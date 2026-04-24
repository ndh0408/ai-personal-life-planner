# LifeOS AI

**LifeOS AI** is a personal life operating system — a 24/7 assistant that helps a single user run their day-to-day life across **schedule, work, health, food, finances, goals, and habits**. The AI watches signals (sleep, overdue tasks, skipped meals, budget burn-rate) and surfaces insights without waiting to be asked.

This repository is a **monorepo** containing the mobile app, the API, and a shared package for cross-cutting types and validation.

> **Status:** production-grade foundation. Auth, data layer, i18n (vi/en), AI proxy boundary, and 13 NestJS modules are wired up. Finance and Goals modules are scaffolded at the route level; their deep schemas land in the next iteration (see [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md)).

---

## Repository layout

```
.
├── apps/
│   ├── api/         # NestJS + Prisma + PostgreSQL backend
│   └── mobile/      # React Native + Expo app (i18next + vi/en)
├── packages/
│   └── shared/      # Shared TypeScript types + Zod schemas (@planner/shared)
├── docker/          # docker-compose for local Postgres (+ pgadmin profile)
├── docs/            # Architecture, product scope, i18n, auth, API reference
├── scripts/         # One-shot helper scripts
├── .env.example     # Root env example
└── package.json     # npm workspaces
```

> **Note on package names.** The npm workspaces are `@lifeos/api`, `@lifeos/mobile`, and `@planner/shared`. The `@planner/shared` name is kept as an internal identifier to avoid churning ~40 import paths; user-facing branding everywhere is "LifeOS AI".

---

## Stack

| Layer    | Tech |
| -------- | ---- |
| Mobile   | React Native + Expo + TypeScript, i18next + react-i18next, React Query, Zustand, React Navigation |
| Backend  | NestJS + TypeScript, Passport JWT, `@nestjs/throttler`, Helmet |
| Database | PostgreSQL 16 |
| ORM      | Prisma |
| Auth     | JWT access + refresh tokens (refresh stored as sha256 hash, rotated on refresh) |
| Validation | Zod (shared between mobile & API via `@planner/shared`) |
| AI       | Server-side only — mobile never holds the provider key |
| Container| Docker (Postgres locally; `apps/api/Dockerfile` for the API) |
| i18n     | Vietnamese (default) + English on both mobile and API |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.

---

## Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **npm 10+** (workspaces)
- **Docker Desktop** (for local Postgres) — or a local Postgres on port 5440
- **Expo Go** app on your phone, or Android Studio / Xcode for emulators

---

## First-time setup

```bash
# 1. Copy env templates
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# 2. Install dependencies (npm workspaces installs everything)
npm install

# 3. Start Postgres (docker-compose)
npm run dev:db

# 4. Generate Prisma client + run migrations
npx --workspace apps/api prisma generate
npm run --workspace apps/api db:migrate:deploy

# 5. (Optional) seed demo data
npm run db:seed
```

> **Important:** edit `apps/api/.env` and replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with strong random values — `openssl rand -hex 64`. The API refuses to boot with the placeholder values.

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

If your phone can't reach `localhost`, set `EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-ip>:3000/api` in `apps/mobile/.env`.

---

## Root scripts

| Command | What it does |
| --- | --- |
| `npm run dev:api` | Start the NestJS API in watch mode |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run dev:db` | Start Postgres via docker compose |
| `npm run dev:db:down` | Stop Postgres |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run build` | Build shared package + API |
| `npm run lint` | Lint every workspace that defines a `lint` script |
| `npm run typecheck` | TypeScript `noEmit` across every workspace |
| `npm test` | Run tests across every workspace |
| `npm run format` | Prettier-format the repo |

---

## Testing the auth flow

```bash
curl -sX POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeMe123!","name":"Alice"}'

curl -sX POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeMe123!"}'
# → { accessToken, refreshToken, expiresIn }

curl -s http://localhost:3000/api/me \
  -H "Authorization: Bearer $ACCESS"
```

Full flow + error-code catalog: [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md).

---

## Internationalization

- Default locale: **`vi`** (Tiếng Việt).
- Supported: `vi`, `en`.
- Mobile: `apps/mobile/src/i18n/` (i18next + AsyncStorage persistence + device detection).
- Backend: reads locale from `UserProfile.locale` → `Accept-Language` → `vi`.
- Errors: backend returns stable `errorCode`; mobile translates via i18n keys.

Full guide: [docs/I18N.md](docs/I18N.md).

---

## Security defaults

- Passwords hashed with bcrypt (cost 10). Server never logs password, hash, or tokens.
- Refresh tokens stored as SHA-256 hashes; `/auth/refresh` rotates and revokes the previous one.
- Helmet enabled, CORS configurable per env.
- Global throttler (120 req / 60s) **plus** per-endpoint limits on `/auth/*`:
  - `register`: 5 / min / IP
  - `login`: 10 / min / IP
  - `refresh`: 30 / min / IP
- Env vars validated with Zod at boot — the API refuses to start with weak/missing JWT secrets.
- `.env*` gitignored; only `.env.example` is checked in.
- Production mode (`NODE_ENV=production`) hides raw 5xx internals from responses.

---

## Building production mobile bundles

```bash
npm i -g eas-cli
eas login

# From apps/mobile/
eas build --platform android --profile preview     # internal APK
eas build --platform android --profile production  # AAB for Play Store
eas build --platform ios     --profile production  # IPA for App Store
```

`apps/mobile/eas.json` defines the build profiles.

---

## Why AI calls live behind the API

The mobile app **never** holds an AI provider key. All AI traffic flows through `POST /api/ai/*`, where the API:

- holds the provider key (server-side env)
- enforces auth, throttling, and audit logging
- can later add caching, prompt versioning, and provider failover without re-shipping the app

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Ports

- API: **3000** (override via `PORT`)
- Postgres: **5440** (override via `POSTGRES_PORT` in `docker/.env`) — 5440 to avoid collision with any local Postgres on 5432

---

## Demo account

After `npm run db:seed`:

```
email:    demo@planner.local
password: demo1234
```

The demo user is fully populated — profile, today's schedule, tasks, habits with 7 days of logs, meal plan, sleep/mood logs, AI conversation, recommendations, notification log. See [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

---

## Docs index

- [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) — what LifeOS AI is and is not
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — monorepo + runtime topology
- [docs/API_SETUP.md](docs/API_SETUP.md) — run the backend locally
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — endpoints, payloads, status codes
- [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md) — register/login/refresh/logout + error codes
- [docs/I18N.md](docs/I18N.md) — vi/en on mobile and API
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — Prisma data model
- [docs/MOBILE_SETUP.md](docs/MOBILE_SETUP.md) — run the mobile app locally
- [docs/AI_ENGINE.md](docs/AI_ENGINE.md) — provider abstraction + prompt pipeline
