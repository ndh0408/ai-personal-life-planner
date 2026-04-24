# Reports module — mobile + backend

Four report surfaces that give the user gentle, observational snapshots of how life is going. Each screen combines a **structured data pull** (backend, deterministic numbers) with an optional **AI narrative layer** (LLM-generated, locale-aware, non-judgmental). Numbers never come from the LLM; the LLM only observes the numbers.

## Screens

Landing: `ReportsScreen` → tile grid with 4 entry points.
- `DailyReview` — today's wins, issues, meals, sleep/mood, spending, tomorrow's gentle nudges.
- `WeeklyReport` — 7-day wrap: schedule completion, task + habit + sleep + mood + meal + spending trends, budget warnings, goal progress, AI insight.
- `MonthlyFinanceReport` — income, expense, saving, spending-by-category, budget usage, debts, saving goals, AI advice.
- `GoalProgressReport` — cross-goal dashboard: average percent, behind-deadline count, per-goal progress cards that link to `GoalDetail`.

All four share three guarantees:
1. **Empty-state first** — if there's no data for that window, render an `EmptyState` instead of a misleading "0" card.
2. **Disclaimer footer** — every AI section ends with a one-line disclaimer framing the output as "observation, not judgment".
3. **Locale-aware** — all labels, all money formatting, all AI prompts route through `t()` + `formatMoneyByLocale`.

## API surface

### Backend endpoints (NestJS)

```
GET /api/reports/daily?date=YYYY-MM-DD
GET /api/reports/weekly?weekStart=YYYY-MM-DD   (legacy ?from= still accepted)
GET /api/reports/monthly-finance?month=YYYY-MM
GET /api/reports/goal-progress
```

Plus the AI endpoints that already exist and provide the narrative:

```
POST /api/ai/daily-review       { date }
POST /api/ai/weekly-insight     { weekStart }
POST /api/ai/analyze-finance    { month }
```

### Response shapes

`/reports/daily` returns `tasks`, `habits`, `schedule`, `sleep`, `mood`, `meals` (count + total calories + total cost + top items), `spending` (total + byCategory + top3 expenses).

`/reports/weekly` returns per-day schedule completion + per-day spending for the bar charts, plus rollups: tasks-by-status, habit consistency%, sleep average + entries, mood entries, meal-days-logged, spending-by-category, `budgetWarnings` (usage% per active budget), `goalProgress` (percent + behindDeadline).

`/reports/monthly-finance` returns `totals {income, expense, saving, savingRatePercent}`, `byCategory`, `byNeedLevel` (NEED/WANT/WASTE/INVESTMENT/SAVING), `budgetUsage`, `debts {iOwe, owedToMe, items}`, `savingGoals` (percent + targetDate).

`/reports/goal-progress` returns `byStatus` (count per PersonalGoalStatus), `averagePercent` across ACTIVE goals, `behindCount`, and `goals[]` with per-goal percent + milestones + deadline + `behindDeadline` flag.

## Backend service (`apps/api/src/modules/reports/reports.service.ts`)

- Pure read-only aggregator — does NOT write `FinancialSnapshot` or similar. Writes stay in the owning modules.
- Uses `prisma.$transaction`-friendly parallel reads via `Promise.all`. No N+1 except the budget-usage lookup, which is intentional: each active budget has its own `startDate..endDate` window, so we sum expenses per budget rather than filtering once.
- All Decimal values go through a `toNumber()` helper so the JSON payload is finite floats, never strings.
- Goal percent logic prefers numeric `currentValue/targetValue` when present, then falls back to milestone completion ratio.
- `behindDeadline` triggers only when `status=ACTIVE`, `deadline < today`, and `percent < 100` — a completed goal past its deadline isn't "behind".

## Mobile client

### API layer — `apps/mobile/src/services/api/reports.api.ts`

One file with four typed methods + the 4 response types mirroring the backend shapes. Nothing fancy.

### Charts — `apps/mobile/src/components/ui/BarChart.tsx`

A dependency-free vertical bar chart:
- Each bar is a flex column sized by `value / peak`.
- Zero-value bars render as a thin outlined slot so the user sees the day exists.
- `tone` tints the fill color; full-featured charts belong to a future lib upgrade.

Used on WeeklyReport for schedule-completion (per-day %) and spending (per-day VND) strips.

### Screen composition

Each report screen has the same shape:
1. `useQuery(['reports', key, param])` fetches structured data — cached by param.
2. An opt-in `useMutation` triggers the AI narrative; result held in local `useState` so the user can regenerate without losing the view.
3. An `EmptyState` renders when there's no activity at all in the window.
4. A `disclaimer` line under every AI card.

No optimistic writes, no auto-refresh beyond `refetch` on pull-to-refresh (`GoalProgressReport`). Stale data is fine here — reports are about reflection, not real-time.

## Navigation

New routes in `RootStackParamList`:
```
Reports: undefined;
GoalProgressReport: undefined;
```

`Reports` is a hub, the others sit beside it. All rendered as push screens (not modals) so deep-linking is natural.

## Non-judgmental tone guarantees

- Section titles: "What went well" (not "Goals"), "Worth a gentle look" (not "Failures"), "Saved this month" (not "Net savings" or "You overspent").
- Empty-state descriptions guide the user to add data, never scold.
- AI prompts inherit the existing `BASE_GUARDRAILS` in `AiModule`: supportive tone, no weight/money shaming, no promised returns, no medical advice.
- Disclaimer line under every AI card: "Reports are observations, not judgments — you know your context best." / "Báo cáo là quan sát, không phải phán xét — bạn hiểu bối cảnh của mình hơn ai hết."

## i18n coverage

Each screen maps to its own nested namespace to avoid key-clash between the simple labels and the detail sections:

- `reports.{title, subtitle, daily, weekly, monthly, goalProgress, disclaimer, ...}` — labels + shared strings.
- `reports.dailySections.*` — DailyReview block titles + rows + pluralized counts.
- `reports.weeklySections.*` — Weekly block titles + empty state + bar-chart labels.
- `reports.monthlySections.*` — Monthly block titles + empty state + saving-rate template.
- `reports.goalsSections.*` — GoalProgressReport.

Every chart label (day-of-week) flows through `toLocaleDateString(undefined, { weekday: 'short' })` so it picks up system locale automatically without a manual lookup table.

## Query-key map

```
['reports', 'daily', date]
['reports', 'weekly', weekStart]
['reports', 'monthly-finance', month]
['reports', 'goal-progress']
```

Nothing else invalidates these today — data is read-only from this module's perspective. Other modules (tasks, expenses, goals, etc.) invalidate their own keys, but the reports queries refetch on screen-open via React Query's default staleness.

## Testing (manual)

1. Settings → Language → vi. Open Reports tab → 4 tiles render with icons.
2. Tap `Báo cáo ngày` with no logs today → empty state. Log a task, an expense, a meal, log sleep via check-in → back to screen → all four cards populate with numbers. Tap `Tạo báo cáo hôm nay` → AI narrative appears in VI.
3. Tap `Báo cáo tuần` → bar chart for schedule completion renders with per-day %; spending bar chart renders daily totals. Budget warnings and goal-progress cards appear.
4. Tap `Tài chính tháng` → income + expense + saving MoneyCards; by-category list with inline % bars; budget usage badges (danger when ≥100%, warning when overThreshold); debts split i-owe / owed-to-me; saving goals ProgressCards. Tap "Phân tích tháng này" → AI allocation + patterns + suggestions in VI.
5. Tap `Tiến độ mục tiêu` → average% + behind-count summary; active goals as ProgressCards (orange tone when behind deadline); tap any card → pushes GoalDetail.
6. Pull-to-refresh on GoalProgressReport → fresh fetch.
7. Switch language to en → every label flips including chart labels + AI narratives.
