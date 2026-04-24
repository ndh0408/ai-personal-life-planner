# Database Schema — LifeOS AI

PostgreSQL 16, accessed via Prisma 5. Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

31 models across 10 domains — everything a personal life OS needs: identity, planner, tasks, habits, meals, wellbeing, finance, goals, AI, notifications.

## Conventions

- **Primary keys**: `String @id @default(uuid())`.
- **Timestamps**: every mutable model has `createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`); append-only models (`AIMessage`, `NotificationLog`) keep only `createdAt`.
- **Enums** use `SCREAMING_SNAKE_CASE` to match the product spec.
- **Date-only** columns use `@db.Date`. **Time-of-day-only** columns use `@db.Time(0)`.
- **Money** uses `Decimal @db.Decimal(18, 2)` — cents-safe up to 9.99 × 10^15.
- **Cascade deletes** flow from `User` down to every owned record (deleting a user removes all their data).
- **SET NULL** on wallet FKs from `Income`/`Expense` so deleting a wallet doesn't delete historical records.
- **Indexes** cover the columns most commonly filtered/sorted: `userId`, `date`, `status`, `dueDate`, `category`, `month`, plus composite variants.
- **Table names** are snake_case via `@@map` so raw SQL stays idiomatic.

## Entity overview

```
User ─┬─ UserProfile (1:1)
      ├─ NotificationSetting (1:1)
      ├─ RefreshToken*                           (auth)
      │
      ├─ DailySchedule* ─ ScheduleItem*          (planner)
      ├─ Task*                                   (todos)
      ├─ Habit* ─ HabitLog*                      (habits)
      │
      ├─ MealPlan* ─ MealSuggestion*             (food / AI plan)
      ├─ MealLog*                                (food / actually eaten)
      │
      ├─ SleepLog*, MoodLog*, HealthMetric*      (wellbeing)
      │
      ├─ Wallet* ─┬─ Income*                     (finance)
      │           └─ Expense*                    (finance)
      ├─ Budget*                                 (finance)
      ├─ Debt*, SavingGoal*, FinancialSnapshot*  (finance)
      │
      ├─ PersonalGoal* ─ GoalMilestone*          (goals)
      │
      ├─ AIConversation* ─ AIMessage*            (chat)
      ├─ AIRecommendation*                       (proactive nudges)
      ├─ DailyReview*, WeeklyReview*             (AI summaries)
      │
      ├─ NotificationDevice*                     (push tokens)
      └─ NotificationLog*                        (delivery audit)
```

---

## A. Identity

| Model | Purpose | Key columns / constraints |
| --- | --- | --- |
| `User` | Account root. | `email @unique`, `displayName`, `role` (`USER`/`ADMIN`), `status` (`ACTIVE`/`DISABLED`). Index on `status`. |
| `UserProfile` | Personal context: goals, schedule preferences, body metrics, salary/currency/locale. | `userId @unique`, `mainGoal` (9 values inc. `FINANCIAL_STABILITY`/`CAREER_GROWTH`), `activityLevel`, `usualWake/SleepTime`, `monthlySalary` (Decimal), `salaryDay`, `currency` default `VND`, `timezone` default `Asia/Ho_Chi_Minh`, `locale` default `vi`. |
| `RefreshToken` | Per-session refresh token — stored only as SHA-256 hash. | `tokenHash @unique`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`. Indexed on `userId`, `expiresAt`. |

## B. Planner

| Model | Purpose | Key columns |
| --- | --- | --- |
| `DailySchedule` | One row per user per day with high-level summary + AI metadata. | `@@unique([userId, date])`, `status` (`DRAFT`/`ACTIVE`/`COMPLETED`/`ARCHIVED`), `aiGenerated`, `energyLevel`, `mood`. |
| `ScheduleItem` | Individual blocks inside a day. | `type` (`SLEEP`/`MEAL`/`WORK`/`STUDY`/`EXERCISE`/`REST`/`TASK`/`TRAVEL`/`FINANCE`/`HEALTH`/`PERSONAL`/`CUSTOM`), `priority`, `status` (`PENDING`/`COMPLETED`/`SKIPPED`/`DELAYED`), `aiGenerated`, `reason`, `sortOrder`. Indexed `(scheduleId, sortOrder)`, `(userId, status)`, `(userId, startTime)`. |

## C. Tasks

| Model | Purpose | Key columns |
| --- | --- | --- |
| `Task` | Standalone to-dos — not tied to a daily schedule. | `status` (`TODO`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`), `priority`, `dueDate`, `estimatedMinutes`, `category`, `completedAt`. Indexed on `(userId, status)`, `(userId, dueDate)`, `(userId, priority)`, `(userId, category)`. |

## D. Habits

| Model | Purpose | Key columns |
| --- | --- | --- |
| `Habit` | Recurring routines. | `frequency` (`DAILY`/`WEEKLY`/`CUSTOM`), `targetCount`, `isActive`. |
| `HabitLog` | One row per habit per date — completion / count / note. | `@@unique([habitId, date])`, indexed on `(userId, date)`. |

## E. Meals / Nutrition

| Model | Purpose | Key columns |
| --- | --- | --- |
| `MealPlan` | One row per day — the AI-generated plan. | `@@unique([userId, date])`, `goal`, `budget`, `availableIngredients: String[]`. |
| `MealSuggestion` | Plan children: breakfast/lunch/dinner/snack suggestions. | `mealType` (`BREAKFAST`/`LUNCH`/`DINNER`/`SNACK`), `ingredients: String[]`, `estimatedCalories`, `prepTimeMinutes`. |
| `MealLog` | What the user actually ate (separate from the plan). | `mealType`, `title`, `estimatedCalories`, `cost` (Decimal). Indexed on `(userId, date)`, `(userId, mealType)`. |

## F. Wellbeing

| Model | Purpose | Key columns |
| --- | --- | --- |
| `SleepLog` | `@@unique([userId, date])`. Server computes `durationMinutes`. | `quality` (`VERY_BAD`/`BAD`/`NORMAL`/`GOOD`/`VERY_GOOD`). |
| `MoodLog` | `@@unique([userId, date])`. | `mood` (6 values), `energyLevel`, `stressLevel`. |
| `HealthMetric` | Daily body + activity metrics. | `weightKg`, `waterIntakeMl`, `steps`, `exerciseMinutes`. Indexed on `(userId, date)`. |

## G. Finance

| Model | Purpose | Key columns |
| --- | --- | --- |
| `Wallet` | Money buckets. | `type` (`CASH`/`BANK`/`EWALLET`/`SAVINGS`/`OTHER`), `balance` Decimal, `currency` default `VND`, `isActive`. |
| `Income` | Salary + side income + freelance. | `walletId?` (SET NULL on delete), `amount` Decimal, `category`, `source`, `incomeDate`, `isRecurring`, `recurringRule`. Indexed on `(userId, incomeDate)`, `(userId, category)`. |
| `Expense` | All outgoings. | `walletId?` (SET NULL), `amount` Decimal, `category`, `needLevel` (`NEED`/`WANT`/`WASTE`/`INVESTMENT`/`SAVING`), `paymentMethod`. Indexed on `(userId, expenseDate)`, `(userId, category)`, `(userId, needLevel)`. |
| `Budget` | Category-level caps. | `period` (`WEEKLY`/`MONTHLY`), `alertThresholdPercent` default 80. Indexed on `(userId, category)`, `(userId, startDate, endDate)`. |
| `Debt` | Owed / owed-to-me. | `type` (`I_OWE`/`OWED_TO_ME`), `totalAmount`, `paidAmount`, `dueDate`, `status` (`ACTIVE`/`PAID`/`CANCELLED`). |
| `SavingGoal` | Target savings with progress. | `targetAmount`, `currentAmount`, `targetDate`, `priority`, `status` (`ACTIVE`/`COMPLETED`/`CANCELLED`). |
| `FinancialSnapshot` | Per-month aggregate for reports. | `@@unique([userId, month])` — `month` is `"YYYY-MM"` string. `totalIncome`, `totalExpense`, `totalSaving`, `debtRemaining`, `budgetUsagePercent`. |

## H. Personal Goals

| Model | Purpose | Key columns |
| --- | --- | --- |
| `PersonalGoal` | Long-horizon goals. | `category` (`HEALTH`/`FINANCE`/`CAREER`/`STUDY`/`RELATIONSHIP`/`PERSONAL`/`OTHER`), `targetValue` Float, `currentValue`, `unit`, `deadline`, `priority`, `status` (`ACTIVE`/`COMPLETED`/`PAUSED`/`CANCELLED`). |
| `GoalMilestone` | Goal children. | `status` (`TODO`/`COMPLETED`/`CANCELLED`), `targetDate`, `completedAt`. |

## I. AI / Assistant

| Model | Purpose | Key columns |
| --- | --- | --- |
| `AIConversation` | Chat session grouping. | `contextType`, `title`. Indexed on `(userId, updatedAt)`. |
| `AIMessage` | Messages in a conversation. | `role` (`USER`/`ASSISTANT`/`SYSTEM`), `content`, `metadata` Json. Indexed on `(conversationId, createdAt)`. |
| `AIRecommendation` | Proactive nudges emitted by the assistant. | `type` (`SCHEDULE`/`TASK`/`HABIT`/`MEAL`/`SLEEP`/`HEALTH`/`FINANCE`/`BUDGET`/`GOAL`/`GENERAL`), `priority`, `status` (`NEW`/`VIEWED`/`APPLIED`/`DISMISSED`), `sourceData` Json. |
| `DailyReview` | AI-generated summary of a day. | `@@unique([userId, date])`, `summary`, `wins`, `issues`, `suggestions` (each Json). |
| `WeeklyReview` | Weekly summary with per-domain insights. | `@@unique([userId, weekStart])`, per-domain `*Insight` strings + `suggestions` Json. |

## J. Notifications

| Model | Purpose | Key columns |
| --- | --- | --- |
| `NotificationDevice` | Push tokens per user-device. | `@@unique([userId, pushToken])`, `platform` (`IOS`/`ANDROID`/`WEB`), `deviceName`, `isActive`. |
| `NotificationSetting` | Per-user reminder prefs. | `userId @unique`. Toggles: `wakeReminder`, `sleepReminder`, `mealReminder`, `taskReminder`, `habitReminder`, `moodCheckinReminder`, `financeReminder`, `budgetAlert`, `goalReminder`, `assistantNudge`. Optional `quietHoursStart/End` (time-of-day). |
| `NotificationLog` | Delivery audit. | `status` (`PENDING`/`SENT`/`FAILED`/`CANCELLED`), `scheduledAt`, `sentAt`, `error`. Indexed on `(userId, status)`, `(userId, type)`, `scheduledAt`. |

---

## Enum reference

| Enum | Values |
| --- | --- |
| `UserRole` | `USER`, `ADMIN` |
| `UserStatus` | `ACTIVE`, `DISABLED` |
| `MainGoal` | `LOSE_WEIGHT`, `GAIN_WEIGHT`, `SLEEP_EARLY`, `PRODUCTIVE`, `STUDY`, `HEALTHY`, `BALANCE`, `FINANCIAL_STABILITY`, `CAREER_GROWTH` |
| `ActivityLevel` / `EnergyLevel` / `StressLevel` / `Priority` | `LOW`, `MEDIUM`, `HIGH` |
| `Mood` | `HAPPY`, `NORMAL`, `STRESSED`, `TIRED`, `SAD`, `MOTIVATED` |
| `DailyScheduleStatus` | `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVED` |
| `ScheduleItemType` | `SLEEP`, `MEAL`, `WORK`, `STUDY`, `EXERCISE`, `REST`, `TASK`, `TRAVEL`, `FINANCE`, `HEALTH`, `PERSONAL`, `CUSTOM` |
| `ScheduleItemStatus` | `PENDING`, `COMPLETED`, `SKIPPED`, `DELAYED` |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `HabitFrequency` | `DAILY`, `WEEKLY`, `CUSTOM` |
| `MealType` | `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK` |
| `SleepQuality` | `VERY_BAD`, `BAD`, `NORMAL`, `GOOD`, `VERY_GOOD` |
| `WalletType` | `CASH`, `BANK`, `EWALLET`, `SAVINGS`, `OTHER` |
| `NeedLevel` | `NEED`, `WANT`, `WASTE`, `INVESTMENT`, `SAVING` |
| `BudgetPeriod` | `WEEKLY`, `MONTHLY` |
| `DebtType` | `I_OWE`, `OWED_TO_ME` |
| `DebtStatus` / `SavingGoalStatus` | `ACTIVE`, `PAID`/`COMPLETED`, `CANCELLED` |
| `GoalCategory` | `HEALTH`, `FINANCE`, `CAREER`, `STUDY`, `RELATIONSHIP`, `PERSONAL`, `OTHER` |
| `PersonalGoalStatus` | `ACTIVE`, `COMPLETED`, `PAUSED`, `CANCELLED` |
| `MilestoneStatus` | `TODO`, `COMPLETED`, `CANCELLED` |
| `AIMessageRole` | `USER`, `ASSISTANT`, `SYSTEM` |
| `AIRecommendationType` | `SCHEDULE`, `TASK`, `HABIT`, `MEAL`, `SLEEP`, `HEALTH`, `FINANCE`, `BUDGET`, `GOAL`, `GENERAL` |
| `AIRecommendationStatus` | `NEW`, `VIEWED`, `APPLIED`, `DISMISSED` |
| `NotificationPlatform` | `IOS`, `ANDROID`, `WEB` |
| `NotificationStatus` | `PENDING`, `SENT`, `FAILED`, `CANCELLED` |

---

## Migrations

| Migration | Summary |
| --- | --- |
| `20260424071146_init_full_schema` | Initial 18 models — auth, planner, tasks, habits, meals, wellbeing, AI, notifications. |
| `20260424071200_add_profile_locale` | Adds `UserProfile.locale` (default `"vi"`) for backend i18n. |
| `20260424101836_add_finance_goals_reviews_and_profile_salary` | Adds Finance (Wallet/Income/Expense/Budget/Debt/SavingGoal/FinancialSnapshot), Goals (PersonalGoal/GoalMilestone), Reviews (DailyReview/WeeklyReview), `MealLog`, `HealthMetric`. Extends `MainGoal` + `ScheduleItemType` enums. Upgrades `AIRecommendation.type` from free-text to enum (in-place cast, preserving existing rows). Adds `NotificationSetting.financeReminder / budgetAlert / goalReminder / assistantNudge`. Adds `UserProfile.monthlySalary / salaryDay / currency`. |

Run `npm run --workspace apps/api db:migrate:deploy` to apply, or `npx prisma migrate dev` to create new migrations.

## Seed

`apps/api/prisma/seed.ts` populates the demo account (`demo@planner.local` / `demo1234`) with:
- profile with monthlySalary = 25M VND, locale = `vi`, main goal = `FINANCIAL_STABILITY`
- 4 wallets (cash, bank, savings, e-wallet), 2 incomes (salary + freelance), 8 expenses across 5 categories
- 4 monthly budgets (with one deliberately over-limit to trigger the AI budget nudge)
- 2 debts (one owed + one owed-to-me), 3 saving goals
- 1 financial snapshot for current month
- 3 personal goals (health/finance/career) + 7 milestones
- today's schedule with 8 items (incl. `FINANCE` type block)
- 4 tasks, 3 habits + 7 days of logs
- today's meal plan with 4 suggestions + 2 meal logs
- 5 days of sleep/mood/health-metric logs
- 1 AI conversation + 3 messages, 4 recommendations (sleep/task/budget/goal)
- yesterday's daily review + current week's weekly review
- notification settings + device + 3 notification logs

Re-running seed wipes the demo user and recreates — it is idempotent.

## Cascade rules

- `User` → all children use `onDelete: Cascade`. Deleting the user removes every row they own.
- `Wallet` → `Income`/`Expense` use `onDelete: SetNull` so wallet removal doesn't destroy financial history.
- `DailySchedule` → `ScheduleItem` cascade.
- `Habit` → `HabitLog` cascade.
- `MealPlan` → `MealSuggestion` cascade.
- `PersonalGoal` → `GoalMilestone` cascade.
- `AIConversation` → `AIMessage` cascade.
