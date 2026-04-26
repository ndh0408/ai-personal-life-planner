# LifeOS AI — Architecture

## Bird's-eye view

```
┌──────────────────────────┐         HTTPS / JSON         ┌──────────────────────────┐
│                          │ ───────────────────────────▶ │                          │
│   Expo React Native app  │                              │     NestJS API           │
│   (apps/mobile)          │ ◀─────────────────────────── │     (apps/api)           │
│                          │   AccessToken (Authorization)│                          │
└──────────────────────────┘                              └────────────┬─────────────┘
                                                                       │
                                                                       │ Prisma
                                                                       ▼
                                                          ┌──────────────────────────┐
                                                          │     PostgreSQL 16        │
                                                          └──────────────────────────┘
                                                                       ▲
                                                                       │ BullMQ
                                                          ┌────────────┴─────────────┐
                                                          │     Redis 7              │
                                                          └──────────────────────────┘
                                                                       ▲
                                                                       │ HTTPS
                                                          ┌────────────┴─────────────┐
                                                          │     OpenAI API           │
                                                          └──────────────────────────┘
```

The mobile app **never** talks to OpenAI directly. All AI traffic is proxied
through the API so the user's key stays encrypted at rest and decrypted only
in-memory for a single request.

## Repository layout

```
lifeos-ai/
├── apps/
│   ├── api/                NestJS + Prisma + JWT + BullMQ
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── prisma/
│   │       └── health/
│   └── mobile/             Expo React Native + TS
│       ├── App.tsx
│       └── app.json
├── packages/
│   └── shared/             Zod schemas + TS types shared by api & mobile
│       └── src/
├── docs/                   This folder
├── docker/                 Reserved for prod compose / helper Dockerfiles
├── scripts/                Dev helpers
├── docker-compose.yml      Local Postgres + Redis
├── package.json            npm workspaces
└── tsconfig.base.json
```

Workspaces are managed by **npm workspaces** (no extra tool — keeps onboarding
zero-friction). `@lifeos/shared` is consumed source-only via the
`paths` aliases in `tsconfig.base.json` so there's no inner build loop.

## Tech choices and the reasons behind them

| Layer | Choice | Why this and not the obvious alternative |
|---|---|---|
| Mobile | Expo SDK 51 + React Native 0.74 | OTA updates + EAS = ship without store roundtrip. RN-only would force native build chain on day 1. |
| API | NestJS 10 | DI + module boundaries match the domain split (auth / ai / capture / …). Express bare would force us to invent the same structure. |
| ORM | Prisma 5 | Type-safe queries + first-class migrations. Drizzle is fine but team already knows Prisma. |
| Database | Postgres 16 | JSONB for flexible AI output, real transactional guarantees. SQLite would block multi-device sync. |
| Queue | BullMQ on Redis 7 | Schedule recurring "assistant nudge" jobs and rate-limit OpenAI calls per user. |
| Auth | JWT access (15m) + refresh (30d, rotated, hashed) | Mobile-friendly, no server session lookup on every request. |
| AI | OpenAI via `openai` npm SDK | Single provider in MVP — explicitly. Multi-provider is phase 2. |
| Encryption | Node `crypto` AES-256-GCM | Stdlib, audited, simple. No third-party crypto. |
| i18n | i18next + react-i18next | Same JSON catalogs work on web companion later. |

## Request lifecycle (typical authenticated call)

1. Mobile reads `accessToken` from `expo-secure-store`.
2. Sends `Authorization: Bearer <accessToken>` to the API.
3. NestJS `JwtAuthGuard` (round 1) verifies signature → attaches `req.user`.
4. Controller validates body via a Zod schema imported from `@lifeos/shared`.
5. Service layer reads/writes Prisma; if AI is involved, it loads the user's
   `AiCredential`, decrypts in-memory, calls OpenAI, never persists raw key.
6. Response is serialised via the matching shared schema.
7. On 401, mobile calls `POST /auth/refresh` once with the refresh token; on
   success, retries the original call.

## Data flow for Quick Capture

```
mobile                  api                  openai            postgres
  │  POST /capture       │                     │                  │
  │ ────────────────────▶│                     │                  │
  │                      │  classify+extract   │                  │
  │                      │ ───────────────────▶│                  │
  │                      │ ◀─── parsed JSON ───│                  │
  │  preview JSON        │                     │                  │
  │ ◀────────────────────│                     │                  │
  │                      │                     │                  │
  │  POST /capture/confirm                     │                  │
  │ ────────────────────▶│                     │                  │
  │                      │  insert row in matching feature table  │
  │                      │ ──────────────────────────────────────▶│
  │  201 + record        │                     │                  │
  │ ◀────────────────────│                     │                  │
```

The two-step (preview → confirm) keeps user agency and avoids fake-success on
low-confidence parses. See [PRODUCT_SPEC §9](./PRODUCT_SPEC.md#9-quick-capture).

## Local environments

- **Dev box** (current): SSH host `huy-server`, repo at `~/AppQuanLY`. Postgres
  + Redis run via root `docker-compose.yml`. API and Expo run on host node.
- **Mobile dev**: Expo Go (LAN) or simulator. `EXPO_PUBLIC_API_BASE_URL` points
  at `http://<dev-box>:4000/api`.
- **Production**: out of scope for this round. Last deploy was wiped on
  2026-04-26; redeploy plan lives in [REBUILD_ROADMAP.md](./REBUILD_ROADMAP.md).

## Non-goals (architectural)

- No microservices. One Nest app, one database, one queue.
- No GraphQL. REST + Zod schemas are enough for one client.
- No CRDT / multi-master sync at MVP. Single source of truth = Postgres.
- No event sourcing. Plain CRUD with audit columns where needed.
