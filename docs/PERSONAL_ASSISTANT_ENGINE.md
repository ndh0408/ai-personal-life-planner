# Personal Assistant Engine — LifeOS AI

LifeOS AI's **proactive layer**. Separate from `AiModule` (which handles
user-initiated requests), this engine runs over the user's data to detect
signals the user didn't ask about — and surfaces them as gentle, localized
recommendations + optional push nudges.

Core promise: **the user doesn't have to open the app to get value.**

## Architecture

```
                         POST /assistant/run-daily-monitoring
                                    │
                                    ▼
                         ┌─────────────────────────┐
                         │  ProactiveNudgeService  │  ←── LocaleService (vi/en)
                         │     .runDaily(user,     │
                         │       date, req)        │
                         └────────┬────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────────┐
           ▼                      ▼                          ▼
   DailyMonitoringService  LifeInsightService       RecommendationService
   (pure signal collector) (0..100 personal         (create / dedupe /
                            scores)                  list / patchStatus)
                                                           │
                                                           ▼
                                                    AIRecommendation row
                                                           │
                                                  priority === HIGH &&
                                                  assistantNudge &&
                                                  not in quiet hours
                                                           │
                                                           ▼
                                                 NotificationLog (PENDING)
```

`BehaviorTrackingService` is a **read-only analytics layer** wired separately
(read by `GET /assistant/today`) — it doesn't participate in recommendation
emission.

## Services

| Service | Writes? | What it does |
| --- | --- | --- |
| `DailyMonitoringService` | ❌ | Scans the user's day + recent history, emits `Signal[]` with stable codes + severity + payload. |
| `LifeInsightService` | ❌ | Returns `PersonalScore` — 11 dimensions, 0..100 + trends. `null` when insufficient data. |
| `RecommendationService` | ✅ `AIRecommendation` | `createFromSignal()` with **24h dedupe by signal code** + `list()` + `patchStatus()`. Owns the signal→title/content template catalog for vi/en. |
| `BehaviorTrackingService` | ❌ | Trailing 14–30 day pattern analytics: postponement hours, habit ranking, rising spending categories, stalled goals, overloaded days. |
| `ProactiveNudgeService` | ✅ `NotificationLog` | Orchestrator: monitoring → recommendation creation → optional push queueing. Single entry point. |

## Signal catalog

Signal codes are **stable** — mobile maps them to icons/illustrations. Add new values; never rename.

| Code | Severity | Template type | Description |
| --- | --- | --- | --- |
| `SCHEDULE_MISSING` | MEDIUM | SCHEDULE | No DailySchedule row for today |
| `SCHEDULE_BEHIND` | HIGH | SCHEDULE | ≥2 items still PENDING past their startTime |
| `SCHEDULE_OVERLOADED` | MEDIUM | SCHEDULE | ≥10 items in the day |
| `SCHEDULE_FREE_WINDOW` | LOW | SCHEDULE | ≥120-min gap between items |
| `TASKS_DUE_SOON` | MEDIUM | TASK | Tasks due today/tomorrow |
| `TASK_OVERDUE` | HIGH | TASK | Tasks past due, not completed |
| `HABITS_NOT_LOGGED` | LOW | HABIT | All active habits skipped today |
| `HABIT_DROPPING` | MEDIUM | HABIT | Daily habit ≤2/5 completions in the last 5 days |
| `MEAL_PLAN_MISSING` | LOW | MEAL | No MealPlan for today |
| `MEAL_SKIPPED_REPEATEDLY` | MEDIUM | MEAL | <5 MealLog entries in last 5 days |
| `UNDER_SLEPT_3D` | HIGH | SLEEP | Avg sleep <6h over last ≥3 nights |
| `SLEEP_CHECKIN_MISSING` | LOW | SLEEP | No SleepLog today |
| `MOOD_CHECKIN_MISSING` | LOW | HEALTH | No MoodLog today |
| `STRESS_HIGH_RECURRING` | MEDIUM | HEALTH | ≥2 days with `stressLevel=HIGH` in last 5 |
| `BUDGET_OVER_THRESHOLD` | HIGH/MEDIUM | BUDGET | Spent in category ≥ `alertThresholdPercent` |
| `SPENDING_ABOVE_BASELINE` | MEDIUM | FINANCE | Today's spend >2× the month's daily avg + >200k |
| `DEBT_DUE_SOON` | HIGH | FINANCE | Active debt with dueDate within 7 days |
| `CASH_LOW_VS_DAYS_LEFT` | HIGH | FINANCE | Salary-remaining < half of pro-rated budget for the days left |
| `FIN_GOAL_BEHIND` | MEDIUM | GOAL | Saving goal <40% with deadline <90 days |
| `PERSONAL_GOAL_BEHIND` | MEDIUM | GOAL | Personal goal <40% with deadline <30 days |

## Personal Score

11 dimensions, all 0..100 or a `Trend` enum. `null` = insufficient data; UI should say "not enough data" rather than show 0.

| Field | Window | Formula (high-level) |
| --- | --- | --- |
| `scheduleCompletionRate` | Today | `completed items / total items × 100` |
| `taskCompletionRate` | Last 7d | `completed tasks / total tasks × 100` |
| `habitConsistencyRate` | Last 7d | `completed logs / (active habits × 7) × 100` (capped 100) |
| `sleepConsistencyScore` | Last 14d | `100 − stddev/6 − abs(avg − 7h)/6` |
| `workloadBalanceScore` | Last 7d | `100 − overloadedDays × 12` |
| `mealConsistencyScore` | Last 7d | `mealLogs / (plans × 3) × 100` |
| `budgetHealthScore` | Current period | `100 − overThresholdCount / total × 100` |
| `savingProgressScore` | Active goals | `avg(current / target × 100)` |
| `goalProgressScore` | Active personal goals w/ numeric target | `avg(current / target × 100)` |
| `energyTrend` | Last 14d | `UP/FLAT/DOWN` by half-series mean diff |
| `stressTrend` | Last 14d | same method |

**Product rule: no shaming.** Never surface a score as "D-grade" or similar.
Low scores should route to actionable recommendations, not critiques.

## Endpoints

All JWT-guarded. Rate limit: inherits global throttler (120/60s).

| Method | Path | Body / Query | Purpose |
| --- | --- | --- | --- |
| `GET` | `/assistant/today` | — | Home-screen snapshot: signals + scores + recommendations + behavior patterns. Read-only. |
| `GET` | `/assistant/recommendations` | `status?`, `limit?` | Paged list of recommendations; default filter is `status in (NEW, VIEWED)`. |
| `PATCH` | `/assistant/recommendations/:id/status` | `{ status }` | Transition `NEW → VIEWED → APPLIED\|DISMISSED`. Blocks reopening terminal states. |
| `POST` | `/assistant/run-daily-monitoring` | `{ date? }` | **The write path.** Runs orchestrator: monitoring → recommendations (24h deduped) → optional notifications. Returns signals + recommendations + scores. |
| `POST` | `/assistant/generate-daily-review` | `{ date }` | Delegates to `AiDailyReviewService.review()` — upserts a `DailyReview` row with AI-generated wins/issues/suggestions. |
| `POST` | `/assistant/generate-weekly-review` | `{ weekStart }` | Delegates to `AiInsightService.weekly()` — upserts a `WeeklyReview` row. |
| `GET` | `/assistant/insights` (legacy alias) | — | Kept for older mobile binaries — routes to `RecommendationService` read path. |
| `POST` | `/assistant/insights/:id/dismiss` (legacy alias) | — | Kept for older mobile binaries — sets status=DISMISSED. |

## Deduplication

`RecommendationService.createFromSignal()` short-circuits and returns the
existing row when, for the same `(userId, signalCode)`, any `NEW` or
`VIEWED` recommendation already exists within the **last 24 hours**.

Implication: the orchestrator is safe to call multiple times per day — the
second call produces 0 new rows. A cron scheduler can call `runDaily` every
hour without spamming the user.

## Scheduling

This iteration ships **manual trigger only** via the HTTP endpoint. The
orchestrator is designed so a future worker can call
`ProactiveNudgeService.runDaily(userId, date)` directly — no HTTP layer
involved. Recommended cadences once the scheduler ships:

| Job | Cadence | Does |
| --- | --- | --- |
| Daily monitoring | Every 60 min, per user | Calls `runDaily(userId, today)` |
| Daily review | 21:30 local time | Calls `generateDailyReview` |
| Weekly review | Sun 20:00 local | Calls `generateWeeklyReview` |
| Notification delivery | Every 2 min | Reads PENDING rows from `NotificationLog`, sends via Expo, updates to SENT/FAILED |

The last one isn't implemented yet — `NotificationLog.PENDING` rows accumulate
until an Expo-push worker lands.

## Notification integration

`ProactiveNudgeService.maybeQueueNudge()` enforces three rules before
writing a `NotificationLog` row:

1. **Opt-in** — `NotificationSetting.assistantNudge` must be `true` (default yes).
2. **Severity gate** — only `priority === HIGH` recommendations queue nudges.
3. **Quiet hours** — if `now` falls inside `[quietHoursStart, quietHoursEnd]`
   (with wrap-around support for e.g. 22:30 → 06:00), the row is created
   with `scheduledAt = nextTimeAfter(quietHoursEnd)` so the future delivery
   worker sends it when the user is awake.

Locale: notification title/body use the recommendation's already-localized
copy (title + content). The recommendation itself is localized at creation
time via `LocaleService.forUser(userId, req)`.

## Copywriting rules

The template catalog in `recommendation.service.ts` is **the single place**
copy changes land. Keep these rules:

- Never shame ("you failed", "you skipped").
- Always frame as an option ("want me to …?", "try …").
- Short — title <40 chars ideally, content <200 chars.
- Vietnamese: conversational register, avoid formal/academic tone.
- English: same voice, calmer than marketing copy.
- Never claim medical, psychiatric, or investment authority.

## Testing

| Spec | Covers |
| --- | --- |
| `recommendation.service.spec.ts` | vi/en template selection, 24h dedupe, ownership, status transitions. |
| `life-insight.service.spec.ts` | Null when no data, ratio math, budget health %, saving avg, trend detection, sleep consistency. |
| `proactive-nudge.service.spec.ts` | HIGH signal queues notification, LOW doesn't, `assistantNudge=false` blocks, quiet-hours defers with scheduledAt. |

Smoke harness: `apps/api/prisma/assistant-smoke.ts` runs monitoring + scoring + sample recommendation creation against the seeded demo user. Invoke with:

```bash
cd apps/api && npx ts-node prisma/assistant-smoke.ts
```

Example output (seed data as of this round):

```
---- SIGNALS (8) ----
  [HIGH  ] SCHEDULE_BEHIND {"date":"2026-04-24","pendingPastCount":2}
  [LOW   ] SCHEDULE_FREE_WINDOW {"date":"2026-04-24","gapMinutes":150,...}
  [MEDIUM] TASKS_DUE_SOON {"count":3,...}
  [MEDIUM] MEAL_SKIPPED_REPEATEDLY {"loggedLast5":2}
  [LOW   ] SLEEP_CHECKIN_MISSING {"date":"2026-04-24"}
  [LOW   ] MOOD_CHECKIN_MISSING {"date":"2026-04-24"}
  [HIGH  ] BUDGET_OVER_THRESHOLD {"category":"shopping","usagePercent":240,...}
  [HIGH  ] DEBT_DUE_SOON {"title":"Covered restaurant bill","daysTo":7,...}

---- SCORES ----
scheduleCompletionRate: 25, taskCompletionRate: 0, habitConsistencyRate: 57,
sleepConsistencyScore: 91, workloadBalanceScore: 100, mealConsistencyScore: 67,
budgetHealthScore: 75, savingProgressScore: 23, goalProgressScore: 36,
energyTrend: UP, stressTrend: DOWN
```

## What's next (not in this round)

- **Cron worker** that calls `ProactiveNudgeService.runDaily()` every hour across active users.
- **Expo push delivery worker** that drains `NotificationLog.PENDING`.
- **AI-augmented signals**: have `AiHealthService` / `AiGoalService` optionally enrich the recommendation body with a personalized sentence.
- **Learning layer**: track `status transitions` (APPLIED vs DISMISSED) per signal code to tune future priority/throttle.
