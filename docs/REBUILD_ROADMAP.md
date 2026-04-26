# LifeOS AI — Rebuild Roadmap

The previous deployment was wiped on **2026-04-26** (DB volume + container +
image + systemd unit + tunnel ingress). The source under `~/AppQuanLY` has been
re-initialised from scratch. This roadmap is the path back to a working,
shippable MVP.

Each round is one focused PR. Foundation completed in round 0 (this round).

---

## Round 0 — Foundation ✅ (this round)

- Monorepo skeleton with npm workspaces.
- `apps/api` (NestJS + Prisma + health endpoint, no auth yet).
- `apps/mobile` (Expo splash, no real screens yet).
- `packages/shared` (auth + ai zod schemas).
- All seven docs.
- Local Postgres + Redis via `docker-compose.yml`.
- Root scripts: `dev`, `dev:api`, `dev:mobile`, `dev:db`, `db:migrate`,
  `db:seed`, `typecheck`, `test`, `lint`.

**Out of scope:** any feature, any UI beyond a splash, any AI call.

---

## Round 1 — Auth + AI key

API:
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
  `POST /auth/logout`, `GET /auth/me`.
- bcrypt password hash, JWT access + refresh, refresh rotation, hashed
  storage of refresh tokens.
- `POST /ai/credentials` with live OpenAI test before persistence.
- `GET /ai/credentials`, `POST /ai/credentials/test`,
  `DELETE /ai/credentials`.
- AES-256-GCM encryption module + spec.

Mobile:
- expo-router 4 screens: register, login, onboarding-key, home placeholder.
- Auth store with `expo-secure-store`.
- API client with auto-refresh on 401.

Done = a real account survives a cold restart and the OpenAI key tests green.

---

## Round 2 — Quick Capture (the heart)

- `POST /capture/parse` (OpenAI structured output) and `/capture/confirm`.
- Mobile `<QuickCaptureBar>` and `<PreviewChip>`.
- Six entity tables: `Task`, `Expense`, `Meal`, `Sleep`, `Mood`, `CalendarEvent`.
- Smart-default rules per entity per locale.
- 30-line vi+en test corpus checked in CI for ≥ 90% classification.

Done = "ăn phở 60k" creates a real `Expense` row in two taps.

---

## Round 3 — Today + Module pages

- Home dashboard: greeting, today summary, 2–3 cards.
- Today planner.
- Per-module list pages (Tasks, Expenses, Meals, Sleep, Mood, Calendar) with
  edit / complete / delete.

---

## Round 4 — AI schedule + Recommendations + Chat

- `POST /assistant/recommendations` (daily nudge generator, BullMQ cron).
- `POST /assistant/schedule` (free-time → task fit).
- `/assistant/chat` SSE-style stream over fetch (no WS in MVP).
- Mobile chat screen with cancel.

---

## Round 5 — Settings + i18n + offline + notifications

- Account settings, language toggle, theme toggle, "Wipe local cache".
- Developer page (hidden behind 7 taps).
- i18next vi/en for every shipped string.
- Local notifications via `expo-notifications` for upcoming tasks.
- Read-after-write cache layer.

---

## Round 6 — Polish + ship

- Empty states for every screen.
- Skeleton loaders matching final layouts.
- Error boundary + toast system.
- App icon, splash.
- EAS Build pipeline (internal distribution).
- API Dockerfile + production compose, redeploy on `huy-server`.
- Reinstate Cloudflare Tunnel ingress for `api.lifeos.<domain>`.
- Smoke test: register → key → capture → confirm → see card on Home, all
  on a fresh device.

---

## Phase 2 (post-MVP, not scheduled)

See [PRODUCT_SPEC §5](./PRODUCT_SPEC.md#5-tính-năng-phase-2). Highlights:
multi-currency, HealthKit / Google Fit, native widgets, real push, voice
mode, web companion, family spaces.

---

## Cadence

One round per session, committed and pushed to `master` at the end of each
round (per project convention, no Claude co-author line in commits).
