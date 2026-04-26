# @lifeos/api

NestJS backend for LifeOS AI. Owns auth, persistence (Prisma + Postgres), the BullMQ
queue (Redis), and proxies all OpenAI calls so the mobile app never holds the user's
API key in plaintext.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) and
[docs/API_CONTRACT.md](../../docs/API_CONTRACT.md) for the full picture.

## Local dev

```bash
cp apps/api/.env.example apps/api/.env
npm run dev:db          # start Postgres + Redis from repo root
npm run db:migrate:dev  # apply schema
npm run dev:api         # nest start --watch
```

API serves on `http://localhost:4000` by default.

## Scripts

- `dev` — nest start --watch
- `build` — compile to `dist/`
- `start` — run compiled output
- `typecheck` — `tsc --noEmit`
- `db:migrate:dev` — Prisma dev migrate
- `db:migrate` — Prisma deploy migrate (production)
- `db:seed` — run `prisma/seed.ts`
- `db:studio` — open Prisma Studio
- `db:reset` — wipe and recreate database
