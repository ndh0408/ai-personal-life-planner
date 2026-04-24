# Database Schema — AI Personal Life Planner

PostgreSQL 16, accessed via Prisma 5. Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

## Conventions

- **Primary keys**: `String @id @default(uuid())`.
- **Timestamps**: every mutable model has `createdAt` (`@default(now())`) and `updatedAt` (`@updatedAt`); append-only models (e.g. `AIMessage`, `NotificationLog`) keep only `createdAt`.
- **Enums** use `SCREAMING_SNAKE_CASE` to match the product spec.
- **Date-only** columns use `@db.Date`. **Time-of-day-only** columns use `@db.Time(0)`.
- **Cascade deletes** flow from `User` down to every owned record (deleting a user removes all their data).
- **Indexes** are added on the columns most commonly filtered/sorted: `userId`, `date`, `status`, `dueDate`, plus the obvious composite ones (`(userId, status)`, `(userId, date)`).
- **Table names** are snake_case via `@@map` so SQL stays idiomatic.

## Entity overview

```
User ─┬─ UserProfile (1:1)
      ├─ NotificationSetting (1:1)
      ├─ RefreshToken*           (auth)
      ├─ DailySchedule* ─ ScheduleItem*    (planner)
      ├─ Task*                              (todos)
      ├─ Habit* ─ HabitLog*                 (habits)
      ├─ MealPlan* ─ MealSuggestion*        (meals)
      ├─ SleepLog*, MoodLog*                (wellbeing)
      ├─ AIConversation* ─ AIMessage*       (chat)
      ├─ AIRecommendation*                  (proactive nudges)
      ├─ NotificationDevice*                (push tokens)
      └─ NotificationLog*                   (delivery audit)
```

## Models

### Identity

| Model | Purpose | Key columns / constraints |
| --- | --- | --- |
| `User` | Account root. | `email @unique`, `displayName`, `role` (`USER`/`ADMIN`), `status` (`ACTIVE`/`DISABLED`). |
| `UserProfile` | Personal context for the planner: goals, schedule preferences, body metrics. | `userId @unique`, `mainGoal`, `activityLevel`, `usualWake/SleepTime`, `timezone` default `Asia/Ho_Chi_Minh`. |
| `RefreshToken` | Per-session refresh token. Stored only as SHA-256 hash. | `tokenHash @unique`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`. Indexed on `userId`, `expiresAt`. |

### Schedule

| Model | Purpose | Key columns |
| --- | --- | --- |
| `DailySchedule` | One row per user per day. Contains the high-level summary + AI metadata. | `@@unique([userId, date])`, `status` (`DRAFT`/`ACTIVE`/`COMPLETED`/`ARCHIVED`), `aiGenerated`, `energyLevel`, `mood`. |
| `ScheduleItem` | Individual blocks inside a day (work, meal, sleep, etc.). | `type` (9 values), `priority`, `status` (`PENDING`/`COMPLETED`/`SKIPPED`/`DELAYED`), `aiGenerated`, `reason`, `sortOrder`. Indexed `(scheduleId, sortOrder)`, `(userId, status)`, `(userId, startTime)`. |

### Tasks & habits

| Model | Purpose | Key columns |
| --- | --- | --- |
| `Task` | Free-form todos. | `priority`, `status` (`TODO`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`), `dueDate`, `estimatedMinutes`, `category`, `completedAt`. Indexed `(userId, status)`, `(userId, dueDate)`, `(userId, priority)`. |
| `Habit` | Recurring activity definition. | `frequency` (`DAILY`/`WEEKLY`/`CUSTOM`), `targetCount`, `color`, `icon`, `isActive`. |
| `HabitLog` | One row per habit per date. | `@@unique([habitId, date])`, `completed`, `count`, `note`. |

### Meals

| Model | Purpose | Key columns |
| --- | --- | --- |
| `MealPlan` | Daily intent: goal, budget, ingredients on hand. | `@@unique([userId, date])`, `availableIngredients String[]`. |
| `MealSuggestion` | One concrete suggestion (typically 3–4 per plan). | `mealType` (`BREAKFAST`/`LUNCH`/`DINNER`/`SNACK`), `ingredients String[]`, `estimatedCalories`, `prepTimeMinutes`, `reason`, `healthNote`. |

### Wellbeing logs

| Model | Purpose | Key columns |
| --- | --- | --- |
| `SleepLog` | Per-day sleep record. | `@@unique([userId, date])`, `sleepTime`, `wakeTime`, `durationMinutes`, `quality` (`VERY_BAD` … `VERY_GOOD`). |
| `MoodLog` | Per-day mood/energy/stress check-in. | `@@unique([userId, date])`, `mood`, `energyLevel`, `stressLevel`. |

### AI

| Model | Purpose | Key columns |
| --- | --- | --- |
| `AIConversation` | One thread of chat with the assistant. | `title`, `contextType` (e.g. `daily-plan`, `weekly-report`). Indexed `(userId, updatedAt)` so "recent chats" is cheap. |
| `AIMessage` | Append-only message inside a conversation. | `role` (`USER`/`ASSISTANT`/`SYSTEM`), `content`, `metadata Json?`. Indexed `(conversationId, createdAt)`. |
| `AIRecommendation` | Standalone proactive nudge (sleep earlier, retry habit, etc.). | `type`, `priority`, `status` (`NEW`/`VIEWED`/`APPLIED`/`DISMISSED`), `sourceData Json?`. |

### Notifications

| Model | Purpose | Key columns |
| --- | --- | --- |
| `NotificationDevice` | Per-device push token. | `@@unique([userId, pushToken])`, `platform` (`IOS`/`ANDROID`/`WEB`), `isActive`. |
| `NotificationSetting` | Per-user preferences. | `userId @unique`, six boolean toggles, `quietHoursStart/End` as `@db.Time(0)`. |
| `NotificationLog` | Delivery audit trail. | `status` (`PENDING`/`SENT`/`FAILED`/`CANCELLED`), `scheduledAt`, `sentAt`, `error`. Indexed `(userId, status)`, `(userId, type)`, `scheduledAt`. |

## Enums

```
UserRole              USER | ADMIN
UserStatus            ACTIVE | DISABLED
MainGoal              LOSE_WEIGHT | GAIN_WEIGHT | SLEEP_EARLY | PRODUCTIVE | STUDY | HEALTHY | BALANCE
ActivityLevel         LOW | MEDIUM | HIGH
EnergyLevel           LOW | MEDIUM | HIGH
Mood                  HAPPY | NORMAL | STRESSED | TIRED | SAD | MOTIVATED
DailyScheduleStatus   DRAFT | ACTIVE | COMPLETED | ARCHIVED
ScheduleItemType      SLEEP | MEAL | WORK | STUDY | EXERCISE | REST | TASK | TRAVEL | CUSTOM
Priority              LOW | MEDIUM | HIGH
ScheduleItemStatus    PENDING | COMPLETED | SKIPPED | DELAYED
TaskStatus            TODO | IN_PROGRESS | COMPLETED | CANCELLED
HabitFrequency        DAILY | WEEKLY | CUSTOM
MealType              BREAKFAST | LUNCH | DINNER | SNACK
SleepQuality          VERY_BAD | BAD | NORMAL | GOOD | VERY_GOOD
StressLevel           LOW | MEDIUM | HIGH
AIMessageRole         USER | ASSISTANT | SYSTEM
AIRecommendationStatus NEW | VIEWED | APPLIED | DISMISSED
NotificationPlatform  IOS | ANDROID | WEB
NotificationStatus    PENDING | SENT | FAILED | CANCELLED
```

> Note: `ActivityLevel`, `EnergyLevel`, `StressLevel`, and `Priority` all share `LOW/MEDIUM/HIGH` literals but live as separate enums so the type system can keep them apart (e.g. you can't accidentally store a `StressLevel` in a `Priority` column).

## Indexes (rationale)

| Composite index | Why |
| --- | --- |
| `daily_schedules (userId, status)` | "Show my active days" / dashboard query. |
| `schedule_items (scheduleId, sortOrder)` | Render a day in order without sorting client-side. |
| `schedule_items (userId, startTime)` | "What's next?" feed across days. |
| `tasks (userId, status)` | Open-task list, the most common query in the app. |
| `tasks (userId, dueDate)` | Due-soon and overdue queries. |
| `tasks (userId, priority)` | Priority-sorted views. |
| `habit_logs (habitId, date)` UNIQUE | Idempotent "mark today done". |
| `habit_logs (userId, date)` | Daily wrap-up: every habit log on day X. |
| `sleep_logs (userId, date)` UNIQUE | One row per night. |
| `mood_logs (userId, date)` UNIQUE | One row per day. |
| `meal_plans (userId, date)` UNIQUE | One plan per day. |
| `ai_conversations (userId, updatedAt)` | Recent-chat sidebar. |
| `ai_messages (conversationId, createdAt)` | Render thread in chronological order. |
| `notification_logs (userId, status)` / `(scheduledAt)` | Send-soon and failed-retry queries. |

## Cascade behavior

- Deleting a `User` removes everything they own.
- Deleting a `DailySchedule` removes its `ScheduleItem`s but does **not** touch the linked `Task`s (none in v1; relation is owner-only).
- Deleting a `Habit` removes its `HabitLog`s.
- Deleting an `AIConversation` removes its `AIMessage`s.

## Demo data

`prisma/seed.ts` creates:

- 1 demo user (`demo@planner.local` / `demo1234`) with full profile + notification settings.
- 1 push device.
- Today's `DailySchedule` with 7 `ScheduleItem`s spanning wake → wind-down.
- 4 `Task`s (one in-progress, two open, one completed).
- 3 `Habit`s with 7 days of logs each (water + meditation) plus 2 workout logs.
- 1 `MealPlan` with 4 `MealSuggestion`s for today.
- 5 `SleepLog`s + 5 `MoodLog`s for the past week.
- 1 `AIConversation` with system/user/assistant messages.
- 2 `AIRecommendation`s.
- 2 `NotificationLog`s (one sent, one pending).

Run with:
```bash
npm run db:seed
```

## Common operations

```bash
npm run dev:db                                       # start Postgres locally
npm run --workspace @planner/api db:generate         # regenerate Prisma client
npm run --workspace @planner/api db:migrate          # create & apply a migration (dev)
npm run --workspace @planner/api db:migrate:deploy   # apply pending migrations (prod)
npm run --workspace @planner/api db:reset            # nuke + re-migrate + reseed (dev only!)
npm run --workspace @planner/api db:studio           # browser-based table viewer
```
