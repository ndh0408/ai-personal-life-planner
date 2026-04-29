# LifeOS AI — Rebuild Roadmap

The previous deployment was wiped on **2026-04-26** (DB volume + container +
image + systemd unit + tunnel ingress). Source under `~/AppQuanLY` was
re-initialised and rebuilt round by round. Each round is one focused
commit-and-push to `master` (no Claude co-author line, per project
convention).

This file is the source of truth for "what shipped, what's next." See
[README.md](../README.md) for the user-facing surface and module list.

---

## Shipped — rounds 0–18

| Round | What landed |
|---|---|
| 0 | Monorepo skeleton, Postgres + Redis compose, npm workspaces, all docs |
| 1 | Auth (argon2 → bcrypt cost 12, JWT 15m + rotating refresh 30d, theft sweep), AES-256-GCM AI-key vault |
| 2 | Quick Capture parser (rules + OpenAI structured-output), 6 entity tables, vi+en parser corpus |
| 3 | Today + per-module pages (Tasks/Expenses/Meals/Sleep/Mood/Calendar) with edit/complete/delete |
| 4 | AI assistant chat, daily-plan generator, recommendations engine |
| 5 | Settings + i18n + dev panel + local notifications |
| 6 | Empty states, skeletons, error boundary, toast system |
| 7–9 | OpenAI chat hardening, recommendations LLM mode, planner snapshot |
| 10 | Dashboard summary + profile PATCH + Home rewrite + onboarding rewrite |
| 11–13 | QuickCapture audit row, sleep "ngủ lúc X dậy Y" overnight pattern, AI plan personalization |
| 14 | Six core CRUD modules (Tasks/Expenses/Wallets/Meals/Sleep/Mood) |
| 15 | Smart-first redesign — IncomeParser, /api/finance/timeline, SmartEntryScreen, AI auto-classifies kind+category |
| 16 | Audit fixes (P0+P1+P2) + responsive layout system (small phone → tablet) |
| 17 | Visual redesign — Ionicons, halo cards, sparklines, vertical timeline rail |
| 18 | Full intelligence upgrade — UserBehaviorSummary, EventLog, AssistantMemory, UserContext aggregator, LLM-driven insights |

Status at end of round 18: API 17 modules, mobile 19 screens, public API
on Cloudflare Tunnel, APK ~59 MB on Xiaomi 13T.

---

## Round 19 — Hygiene baseline (this round)

Production-safety pass. No new features.

- JWT auth guard rejects tokens whose `type` claim is not `access` (defence
  in depth against future config drift).
- Per-account brute-force lockout (5 fails → 15 min lock); IP throttling
  alone is insufficient against credential stuffing.
- Log redaction utility — `Authorization`, `Cookie`, `*token*`, `*secret*`,
  `*password*`, `*apiKey*`, `encryptedApiKey` stripped before any log line
  reaches stdout.
- Mobile env enum (`dev` | `staging` | `prod`) replacing the single
  hardcoded base URL; `APP_BUILD` bumped from `round-16` to `round-19`.
- Roadmap brought back in sync with reality.

Done = tests for guard + lockout + redaction pass; mobile typecheck clean.

---

## Round 20 — LifeSnapshot upgrade + Privacy module

- Promote `UserContextService` to `LifeSnapshotService` with a Redis
  TTL cache (30–60 s) and snapshot-version stamp.
- Consult `PrivacySetting` (`useFinanceForAI`, `useTasksForAI`,
  `useHealthForAI`, `useMealsForAI`) at query time; domains the user has
  disabled never enter the snapshot.
- Add `wallets[]` and `recentCorrections[]` to the snapshot.
- `PrivacyModule` gains a real controller — `GET/PATCH /privacy` so the
  mobile app can flip flags.

Done = assistant + planner + insights all read from the same
privacy-aware snapshot; toggling a privacy flag changes assistant output
on the next turn.

---

## Round 21 — Smart Capture routing + editable preview + correction memory

- Three-tier parser routing: rule ≥ 0.90 auto, 0.55–0.89 calls LLM with
  recent-corrections few-shot, < 0.55 returns `UNKNOWN` + needsReview.
- `QuickCapture` extended with `parseSource`, `parseConfidence`,
  `parseNeedsReview`, `parsedKind`, `parsedPayload`, `finalKind`,
  `finalPayload`, `appliedEntityType`, `appliedEntityId`, `appliedAt`,
  `correctionCount`, `reviewedAt`.
- New `CaptureCorrection` model — every user edit before confirm is
  persisted and fed back into the LLM as few-shot examples.
- `CapturePreviewSheet` and `SmartEntryScreen` previews become fully
  editable per kind (title, amount, category, date/time, wallet, priority,
  meal type, mood, energy). INCOME gets its own editor.
- `SmartEntryScreen` accepts a `mode` param so quick actions on Home
  open with the right kind preselected.

Done = a "ăn phở 60k" sentence parsed wrong once gets parsed right
forever after the user corrects it.

---

## Round 22 — Undo + transactional confirm

- `POST /capture/:quickCaptureId/undo` reverses the entity created by
  confirm inside one transaction; idempotent against double-undo.
- Confirm response now returns `quickCaptureId`, `entityKind`, `entityId`,
  `undoAvailableUntil`.
- Mobile snackbar on save: `Đã lưu` with `Hoàn tác` + `Sửa` actions.
- Idempotency-Key support extended from EXPENSE/INCOME to all kinds.

Done = the user can undo any capture for 60 s after confirm; a network
retry of the confirm with the same idempotency key never duplicates.

---

## Round 23 — Mobile UX rewrite

- Home: collapse three entry points (HomeHero, QuickActionsRow,
  QuickCaptureBar) into a single composer + a `next best action` card.
- Quick actions become mode-specific (open SmartEntry preselecting
  `EXPENSE`, `TASK`, etc.).
- Hidden `DebugScreen` (Settings → 7 taps) showing env, auth stage,
  AI-key status, last parse, last API error, app version + build flavour.
- `APP_BUILD` injected from git SHA at build time.

Done = Home looks calmer; debug screen surfaces every diagnostic the
user might need to file a bug.

---

## Round 24 — Assistant streaming

- Shared assistant stream event model (`started` / `progress` / `delta` /
  `suggested_actions` / `completed` / `error`).
- WebSocket transport for mobile (primary), SSE adapter optional for
  web/admin debugging.
- Mobile chat shows staged progress (`Đang đọc dữ liệu hôm nay…`) then
  streams deltas into the active assistant bubble.
- Stop + Regenerate hooks on the active turn.

Done = first byte under 1 s for cold conversations; the assistant feels
alive instead of frozen.

---

## Round 26 — Mobile streaming client (shipped)

react-native-sse wired in. AssistantScreen drives a real SSE EventSource;
progress events show "Đang đọc dữ liệu hôm nay…" / "Đang suy nghĩ…", deltas
stream live into a sienna bubble, Stop button cancels cleanly, Hỏi lại
re-runs the last prompt.

## Round 27 — Tests (shipped)

@testing-library/react-native + @testing-library/jest-native landed. 22
mobile tests (format/idempotency/debug-store + KindBadge component test)
plus 8 new API tests (privacy + corrections services). Suite total: 127
green tests.

## Round 28 — Production hardening (shipped)

- Liveness / readiness / deep healthcheck split.
- Secrets rotation playbook (docs/SECRETS.md): generation, storage,
  rotation cadence, leak response.
- Idempotent deploy script (scripts/deploy-prod.sh).
- systemd unit (docker/lifeos-api.service) + cloudflared config sample.
- .env.example refreshed.

## Round 25 — CI / compose split / smoke tests

- `compose.yaml` (base) + `compose.dev.yaml` (host ports + bind mounts) +
  `compose.prod.yaml` (no host ports for db/redis, restart policies,
  healthchecks).
- `.github/workflows/ci.yml`: lint+typecheck → api unit/integration →
  mobile unit → android debug build → smoke E2E.
- Maestro flow: register → login → AI key → capture → edit → save →
  undo → ask assistant → assert streamed reply.
- Caches for npm + Gradle, artifact upload for APK + test results.

Done = green PR check is meaningful; merging master rebuilds + smokes
without anyone touching a phone.

---

## Phase 2 (post-MVP, not scheduled)

See [PRODUCT_SPEC §5](./PRODUCT_SPEC.md#5-tính-năng-phase-2). Highlights:
multi-currency, HealthKit / Google Fit, native widgets, real push, voice
mode, web companion, family spaces.
