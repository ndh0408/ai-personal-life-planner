# Changelog

All notable changes to LifeOS AI are recorded here. The previous codebase
(rounds 1–22) was retired on 2026-04-26 along with its deployment; this
file restarts at the foundation rewrite.

## [0.4.5] — 2026-05-03 — Round 45: Aurora Pencil redesign

### Changed
- **Aurora palette** rewritten from rainbow per-moment (coral / turquoise /
  golden / lavender per hour) to **muted midnight indigo** for all five
  moments. One restrained accent — champagne pearl `#E8D5B2` — carries
  active states across the whole app, with soft lavender `#B5A8E0` as the
  ambient companion. Status & kind hues toned down to magazine-like
  saturation. (`packages/aurora/src/palette.ts`)
- **All 5 Aurora screens** rewritten to match the Pencil design spec
  (see `docs/AURORA_R45.md` + `docs/aurora-figma/`):
  - **Today**: ∞ + LifeOS header → date eyebrow → 2-line serif greeting
    → energy ring card (score derived from sleep duration + quality, no
    hardcode) → Mood/Sleep tile row → Now card (smartBrief or nextTask)
    → today's tasks list with category dots.
  - **Plan**: count eyebrow → serif title → Hôm nay/Tuần/Tháng filter
    pills → timeline grouped by 3-hour blocks → progress bar.
  - **Money**: balance hero (huge serif full-VND) → Thu/Chi tile row →
    transactions list with category dots and amount in meta.
  - **Health**: 3 concentric activity rings derived from REAL data
    (Recovery: sleep duration vs 7h target + quality; Vitality: latest
    mood + energy; Rhythm: % of today tasks completed) → sleep card with
    duration bar → mood/week-avg tiles.
  - **Mind**: 7-day mood bar chart fetched from `/mood-logs?range=week`
    grouped by day-of-week (no fake data; muted gray bars when missing)
    → reflection card surfacing latest journal note → AI insight card
    only when ≥3 days logged.
- **Tab bar** rewritten to floating glass pill with Ionicons icon + label
  tabs. Active tab uses solid champagne pearl fill. Floating capture FAB
  at bottom-right opens the new Aurora CaptureSheet.
- **CaptureSheet** (new `apps/mobile/src/aurora/CaptureSheet.tsx`)
  replaces v2-themed `CaptureSheetV2`: grabber + serif "Ghi nhanh" title
  + glass input with italic serif placeholder + 5 category chips
  (Tự nhận / Tiền / Việc / Sức khỏe / Suy nghĩ) + voice icon + champagne
  save button.
- **SettingsSheet** rewritten to Pencil layout: profile row card
  (avatar + name + email) + 5-row settings list with category dots +
  Tiếng Việt/English language pills + sign-out + version footer. All
  status text uses real state (AI-key masked value, current locale).

### Added
- `apps/mobile/src/aurora/AuroraHeader.tsx` — reusable lemniscate ∞ +
  serif brand + glass icon button used by all 5 screens.
- `apps/mobile/src/aurora/CaptureSheet.tsx` — Aurora-themed capture
  bottom sheet (Pencil layout).
- `docs/AURORA_R45.md` — design system spec covering tokens, components,
  screen breakdowns, and data sources.
- `docs/aurora-figma/` — 7 PNG @2x exports of every screen straight from
  the Pencil source.

### Removed
- `apps/mobile/src/components/v2/CaptureSheetV2.tsx` — replaced by Aurora
  CaptureSheet.
- `apps/mobile/src/components/v2/KindChipRow.tsx` — only used by the
  removed CaptureSheetV2.

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
