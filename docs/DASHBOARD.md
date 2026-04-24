# Dashboard

The home tab of LifeOS AI — one screen summarizing everything that matters today across planning, wellbeing, finance, goals, and the assistant feed.

## Design principle

The dashboard is **read-only and single-shot**: one HTTP request (`GET /api/dashboard/summary`) fans in the data for every section. The mobile client does not fan out to 8 endpoints on mount — that would both spam rate limits and race on re-render. Heavy writes (generate schedule, run daily monitoring, dismiss a recommendation) live on the sections/tabs the user navigates to.

Pull-to-refresh is the only refetch trigger on the screen; query invalidation from mutations elsewhere propagates automatically via TanStack Query's `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`.

## Backend: `GET /api/dashboard/summary`

JWT-guarded. Optional `?date=YYYY-MM-DD` query (defaults to today). Response shape (abbreviated):

```ts
type DashboardSummary = {
  date: string;
  locale: 'vi' | 'en';
  greeting: { displayName: string };
  assistantHighlight: { id; type; title; content; priority; createdAt } | null;
  todayPlan: { hasSchedule; scheduleId; items; completed; scheduleStatus };
  finance: {
    currency; monthlySalary; totalIncome; totalExpense; remaining;
    totalCash; walletsCount;
    budgetWarnings: Array<{ category; amount; spent; usedPercent; overThreshold }>;
  };
  health: {
    sleepLatest: { date; durationMinutes; quality } | null;
    moodToday: { mood; energyLevel; stressLevel } | null;
    meals: { planned; logged; nextPlanned };
    habits: { active; completed; logged };
  };
  tasks: {
    todayTotal; todayCompleted; todayPending;
    overdue; highPriorityOpen;
    top: Array<{ id; title; status; priority }>;
  };
  goals: {
    activeTotal; behind;
    topSaving: { id; title; target; current; targetDate } | null;
  };
  scores: PersonalScore;
};
```

### How the server computes each section

Everything runs inside **one `prisma.$transaction` batch** — a single roundtrip to Postgres:

| Section | Source |
| --- | --- |
| `greeting` | `users.displayName` / `userProfile.fullName`. |
| `assistantHighlight` | Top `AIRecommendation` with `status IN ('NEW','VIEWED')`, ordered by `priority DESC, createdAt DESC`. |
| `todayPlan` | `DailySchedule` + `ScheduleItem.status` counts for today. |
| `finance.totalIncome/Expense/remaining` | Sums over `income` + `expense` rows in the current month. |
| `finance.totalCash` | Sum of active wallet balances. |
| `finance.budgetWarnings` | Same formula as `BudgetsService.usage` — filter `overThreshold`, sort by `usedPercent` desc, cap at 3. |
| `health.sleepLatest` | Latest `SleepLog` regardless of date. |
| `health.moodToday` / `habits.logged` | Strict `date = today` filter. |
| `health.meals.nextPlanned` | The Nth `MealSuggestion` where N = count of `MealLog` for today. |
| `tasks` | 3 counters + a top-3 list sorted by priority+dueDate. |
| `goals.behind` | Active `PersonalGoal` with numeric target, deadline within 60 days, and <40% progress. |
| `goals.topSaving` | Active `SavingGoal` ranked by unmet-ratio (`target / (1 + current)` descending). |
| `scores` | Delegated to `LifeInsightService.score()` — same 11-dimension formula the Assistant uses. |

The server **never recomputes** these for write-side consistency — it reads the authoritative ledgers and returns denormalized view-model fields so mobile doesn't have to derive anything.

## Mobile: `DashboardScreen`

Location: `apps/mobile/src/screens/dashboard/DashboardScreen.tsx`.

Structure top-to-bottom, matching the spec's eight sections:

1. **Greeting card** — time-aware ("Good morning…") + formatted date + subtitle summarizing today's counts.
2. **Assistant insight card** — renders the top recommendation via `<RecommendationCard/>` (type + priority badges + body). Falls back to an empty-state card when no open recommendations exist.
3. **Today plan summary** — completed/total schedule items. Two primary actions: **Open plan** → TodayScreen, **Generate with AI** / **Regenerate** → `POST /ai/generate-schedule`. Empty state renders the generate action.
4. **Finance summary** — three `<MoneyCard/>`s (Income / Expense / Remaining) with tone by sign, then up to 3 `budgetWarnings` as compact cards (amber at ≥threshold, red at ≥100%). "View more" jumps to Finance tab.
5. **Health / lifestyle** — 4 `<InsightCard/>`s: Sleep (hours + quality), Mood (+ energy), Meals (logged/planned), Habits (completed/active + 7-day consistency).
6. **Tasks** — 3 stats (today, overdue, high-priority) + top 3 task rows with priority badge. "View more" → Tasks screen.
7. **Goals** — 2 stats (active, behind) + a `<ProgressCard/>` for the most-lagging saving goal. "View more" → PersonalGoals.
8. **Quick actions** — 3-column grid of chip buttons (emoji + label): Add expense, Add income, Add task, Check-in mood, Generate schedule, Ask AI.

### Loading / error / empty

- `isLoading && !data` → `<Loading/>`.
- `error && !data` → `<ErrorView/>` with localized `errorCode` and retry.
- Pull-to-refresh via `<RefreshControl/>` invalidates the `dashboard` query key and refetches.
- Individual sections degrade gracefully: null sleep → `—` in the InsightCard, no recommendations → the assistant empty card, zero tasks/goals → empty-text lines — no section ever blocks the rest.

### Locale + money formatting

Every label routes through `t()`. All money uses `formatMoneyByLocale(amount, currency)` (currency comes back on the payload — VND by default, override via profile). Dates use `formatDateByLocale`.

### Quick-action wiring

All six quick actions use `useNavigation()` to push the relevant screen/modal:

| Action | Target |
| --- | --- |
| Add expense | Root stack `Expense` |
| Add income | Root stack `Income` |
| Add task | Modal `CreateTask` |
| Check-in mood | Modal `SleepMoodCheckin` |
| Generate schedule | Fires `POST /ai/generate-schedule` in place; invalidates dashboard on success |
| Ask AI | Modal `AIChat` |

### React Query keys

```
['dashboard', 'summary']           // the payload
```

Any mutation that moves a field shown on the dashboard should call:

```ts
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

That includes: creating an expense/income, completing a task, logging a habit, logging mood/sleep, dismissing a recommendation, or running daily monitoring.

## Smoke (seeded demo user)

```
cd apps/api && npx ts-node prisma/dash-smoke.ts
```

Latest run prints, among other things:

```
finance:   totalIncome=29,500,000 VND  totalExpense=9,505,000  remaining=19,995,000
           budgetWarnings=[{category: shopping, usedPercent: 240, overThreshold: true}]
tasks:     todayTotal=3, todayCompleted=0, overdue=0, highPriorityOpen=1
goals:     active=3, behind=0, topSaving="Japan trip 2027"
health:    sleepLatest=7h quality=GOOD · meals 1/4 · habits 1/3
todayPlan: hasSchedule=true · items 8 · completed 2
scores:    schedule=25 · habits=57 · sleep=91 · budget=75 · saving=23 · goal=36
           energyTrend=UP · stressTrend=DOWN
```

## Why no client-side aggregation?

We explicitly rejected the option of having the mobile app call 7–8 endpoints in parallel because:

- **Race on refresh.** Pull-to-refresh would re-fire 8 requests; partial failures fragment the UI state.
- **Rate limits.** `/ai/*` is 12/min; the home tab alone shouldn't eat that budget.
- **Consistency window.** A single DB transaction returns a self-consistent snapshot; 8 calls don't.
- **Device cost.** Fewer round-trips = better on cellular + cold-start.

The single endpoint is cheap: the service runs one `prisma.$transaction([...18 reads])` plus one follow-up `findFirst` for the top recommendation, typically <60ms against a warm Postgres. Scale concerns come later with pagination on the `/tasks` list (not the dashboard, which already caps at 3 items).
