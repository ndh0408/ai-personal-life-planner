# Changelog

All notable changes to LifeOS AI are recorded here. The previous codebase
(rounds 1–22) was retired on 2026-04-26 along with its deployment; this
file restarts at the foundation rewrite.

## [0.1.0] — 2026-04-26 — Round 0: Foundation

### Added
- Monorepo skeleton (`apps/api`, `apps/mobile`, `packages/shared`).
- npm workspaces wiring with `tsconfig.base.json` paths for `@lifeos/shared`.
- NestJS API skeleton: `main.ts`, `app.module.ts`, `prisma.module/service.ts`,
  `health.controller.ts`. Health endpoint reports DB connectivity.
- Prisma foundation schema: `User`, `Session`, `AiCredential` (no feature
  tables yet).
- Expo React Native app shell with Editorial Calm splash placeholder.
- `@lifeos/shared` Zod schemas: `auth`, `ai`, `common`.
- Local `docker-compose.yml` for Postgres 16 + Redis 7.
- Seven core docs: PRODUCT_SPEC, ARCHITECTURE, UX_PRINCIPLES, API_CONTRACT,
  MOBILE_DESIGN_SYSTEM, SECURITY_PRIVACY, REBUILD_ROADMAP.
- Helper scripts: `dev-bootstrap.sh`, `check-env.sh`.
- Environment templates at root, api, and mobile levels.

### Notes
- No feature endpoints, no auth flow, no Quick Capture yet — those land in
  rounds 1 and 2 per the roadmap.
