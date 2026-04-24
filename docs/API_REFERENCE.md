# API Reference — LifeOS AI

Base URL: `http://localhost:3000/api`

## Conventions

### Auth
Every endpoint below requires `Authorization: Bearer <accessToken>` unless marked public. Tokens come from `POST /auth/login` (or `/auth/register`). The server reads the user id from the JWT — **clients never send `userId` in the body or path**. All resources are scoped to the caller and IDOR-protected at the service layer (404 if not found, 403 if owned by someone else).

### Response envelope

Success:
```json
{ "success": true, "data": <payload>, "message": "Human-readable summary", "errorCode": null }
```

Error:
```json
{
  "success": false,
  "data": null,
  "message": "What went wrong",
  "errorCode": "STABLE_BACKEND_CODE",
  "issues": [{ "path": "field.path", "message": "..." }],
  "statusCode": 400,
  "path": "/api/...",
  "timestamp": "2026-04-24T07:30:00.000Z"
}
```

Mobile **must** branch on `errorCode`, never on `message`. See [AUTH_FLOW.md](./AUTH_FLOW.md) for the full code catalog.

### Pagination & filtering
Where supported: `?page=1&limit=20`. `limit` is capped at 100. List responses include `{ items, total, page, limit, totalPages }` inside `data`.

### Date / time formats
- Date-only: `YYYY-MM-DD` (e.g. `2026-04-24`).
- Time-of-day: `HH:mm` (24-hour).
- Full timestamps: ISO-8601.
- Money: number (Decimal on the wire). Currency defaults to `VND`.

---

## Health & auth (public or auth-only)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | no | Liveness |
| `GET` | `/health/ready` | no | Liveness + DB ping |
| `POST` | `/auth/register` | no | `{email, password, name?, timezone?}` |
| `POST` | `/auth/login` | no | `{email, password}` |
| `POST` | `/auth/refresh` | no | `{refreshToken}` |
| `POST` | `/auth/logout` | ✅ | Revokes all refresh tokens for the caller |
| `GET` | `/me` | ✅ | Signed-in user + embedded profile |
| `GET` | `/users/me` | ✅ | Alias for `/me` |

---

## Profile

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/profile` | — |
| `PUT` | `/profile` | Upsert profile fields |

Profile body (all optional after first create):
`fullName`, `age`, `gender`, `heightCm`, `weightKg`, `occupation`,
`workStartTime/workEndTime/usualWakeTime/usualSleepTime` (HH:mm),
`mainGoal` (9 enum values including `FINANCIAL_STABILITY`, `CAREER_GROWTH`),
`activityLevel`, `dietaryPreference`, `healthNotes`,
`monthlySalary` (Decimal), `salaryDay` (int 1–31), `currency` (default `VND`),
`timezone`, `locale` (`vi` | `en`).

---

## Planner

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/planner/today?date=YYYY-MM-DD` | Aggregate: day's schedule + items + due tasks + habits + mood snapshot |

---

## Tasks

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/tasks` | Query: `status`, `priority`, `dueDate`, `category`, `q`, `page`, `limit`, `sortBy`, `sortDir` |
| `GET` | `/tasks/:id` | Single task |
| `POST` | `/tasks` | Create |
| `PUT` | `/tasks/:id` | Full update (incl. `status`) |
| `PATCH` | `/tasks/:id/status` | `{ status }` only; sets/clears `completedAt` |
| `DELETE` | `/tasks/:id` | Hard delete |

Body for create/update: `title`, `description?`, `priority?`, `dueDate?`, `estimatedMinutes?`, `category?`.

---

## Schedules & schedule items

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/schedules?date=YYYY-MM-DD` | Day's schedule with items (or `null`) |
| `POST` | `/schedules` | Create (409 if date already has one) |
| `PUT` | `/schedules/:id` | Update top-level fields |
| `DELETE` | `/schedules/:id` | Cascade-deletes items |
| `POST` | `/schedules/:scheduleId/items` | Add an item |
| `PUT` | `/schedule-items/:id` | Update |
| `PATCH` | `/schedule-items/:id/status` | `{ status }` |
| `DELETE` | `/schedule-items/:id` | Remove |
| `PATCH` | `/schedule-items/reorder` | `{ scheduleId, items: [{id, sortOrder}] }` |

Item `type`: `SLEEP|MEAL|WORK|STUDY|EXERCISE|REST|TASK|TRAVEL|FINANCE|HEALTH|PERSONAL|CUSTOM`.

---

## Habits

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/habits` | Active first |
| `POST` | `/habits` | Create |
| `PUT` | `/habits/:id` | Update |
| `DELETE` | `/habits/:id` | Cascade-deletes logs |
| `POST` | `/habits/:id/log` | Upsert log for a given date |
| `GET` | `/habits/logs?date=YYYY-MM-DD&habitId=<uuid>` | Logs (optional filters) |

---

## Meals (plan + logs)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/meals?date=YYYY-MM-DD` | Day's plan with suggestions (or `null`) |
| `POST` | `/meals` | Create plan (409 if date collides) |
| `PUT` | `/meals/:id` | Update plan; `suggestions[]` replaces atomically |
| `DELETE` | `/meals/:id` | Cascade-deletes suggestions |
| `GET` | `/meal-logs?from=&to=&mealType=` | Actually-eaten meals in a date range |
| `POST` | `/meal-logs` | Log a meal (`{date, mealType, title, note?, estimatedCalories?, cost?}`) |
| `PUT` | `/meal-logs/:id` | Update |
| `DELETE` | `/meal-logs/:id` | Remove |

---

## Wellbeing

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sleep-logs` | Upsert per `(user, date)`; server computes `durationMinutes` |
| `GET` | `/sleep-logs?from=&to=` | Range query |
| `PUT` | `/sleep-logs/:id` | Partial update |
| `DELETE` | `/sleep-logs/:id` | Remove |
| `POST` | `/mood-logs` | Upsert per `(user, date)` |
| `GET` | `/mood-logs?from=&to=` | Range query |
| `PUT` | `/mood-logs/:id` | Partial update |
| `DELETE` | `/mood-logs/:id` | Remove |
| `POST` | `/health-metrics` | Create `{date, weightKg?, waterIntakeMl?, steps?, exerciseMinutes?, note?}` |
| `GET` | `/health-metrics?from=&to=` | Range query |
| `PUT` | `/health-metrics/:id` | Partial update |
| `DELETE` | `/health-metrics/:id` | Remove |

---

## Finance

Money is `Decimal(18, 2)` on the wire. `currency` defaults to `VND`.

### Wallets

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/wallets` | Active first, then by createdAt |
| `POST` | `/wallets` | `{ name, type, balance?, currency? }` — `type`: `CASH|BANK|EWALLET|SAVINGS|OTHER` |
| `PUT` | `/wallets/:id` | Partial update |
| `DELETE` | `/wallets/:id` | Cascading income/expense rows keep their history (`walletId` set to NULL) |

### Incomes

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/incomes?from=&to=&category=` | Range query |
| `POST` | `/incomes` | `{ walletId?, title, amount, category?, source?, incomeDate, isRecurring?, recurringRule?, note? }` — **increments wallet balance** if `walletId` is set (atomic transaction) |
| `PUT` | `/incomes/:id` | Reverts the previous wallet effect, applies the new one |
| `DELETE` | `/incomes/:id` | Reverts wallet balance |

### Expenses

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/expenses` | Query: `from`, `to`, `category`, `needLevel`, `page`, `limit` |
| `POST` | `/expenses` | `{ walletId?, title, amount, category, expenseDate, paymentMethod?, needLevel?, note? }` — **decrements wallet balance** if `walletId` is set |
| `PUT` | `/expenses/:id` | Reverts old, applies new |
| `DELETE` | `/expenses/:id` | Refunds wallet balance |

`needLevel`: `NEED | WANT | WASTE | INVESTMENT | SAVING`.

### Budgets

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/budgets` | Each row returns `{ ..., usage: { spent, remaining, usedPercent, overThreshold } }` computed on-the-fly from expenses in the period |
| `POST` | `/budgets` | `{ category, amount, period, startDate, endDate, alertThresholdPercent? }` — `period`: `WEEKLY|MONTHLY`, default threshold 80 |
| `PUT` | `/budgets/:id` | Partial update |
| `DELETE` | `/budgets/:id` | Remove |

### Debts

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/debts` | Active first |
| `POST` | `/debts` | `{ type, personName?, title, totalAmount, paidAmount?, dueDate?, note? }` — `type`: `I_OWE | OWED_TO_ME` |
| `PUT` | `/debts/:id` | Partial update (incl. `status`) |
| `PATCH` | `/debts/:id/payment` | `{ amount, markPaid? }` — increments `paidAmount`; auto-flips to `PAID` when total reached. Rejects overpayment. |
| `DELETE` | `/debts/:id` | Remove |

### Saving goals

| Method | Path | Body / Notes |
| --- | --- | --- |
| `GET` | `/saving-goals` | Active → completed → cancelled |
| `POST` | `/saving-goals` | `{ title, targetAmount, currentAmount?, targetDate?, priority?, note? }` |
| `PUT` | `/saving-goals/:id` | Partial update (incl. `status`) |
| `PATCH` | `/saving-goals/:id/contribute` | `{ amount }` — increments `currentAmount`; auto-completes when target reached |
| `DELETE` | `/saving-goals/:id` | Remove |

---

## Personal goals

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/goals` | Includes `milestones[]` |
| `GET` | `/goals/:id` | Single goal + milestones |
| `POST` | `/goals` | `{ title, description?, category, targetValue?, currentValue?, unit?, deadline?, priority? }` — category: `HEALTH|FINANCE|CAREER|STUDY|RELATIONSHIP|PERSONAL|OTHER` |
| `PUT` | `/goals/:id` | Partial update (incl. `status`: `ACTIVE|COMPLETED|PAUSED|CANCELLED`) |
| `DELETE` | `/goals/:id` | Cascade-deletes milestones |
| `POST` | `/goals/:id/milestones` | `{ title, targetDate? }` |
| `PUT` | `/goal-milestones/:id` | Partial update |
| `PATCH` | `/goal-milestones/:id/status` | `{ status }` — `TODO|COMPLETED|CANCELLED`; auto-stamps `completedAt` |
| `DELETE` | `/goal-milestones/:id` | Remove |

---

## Notifications, reports, AI, assistant

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notifications/settings` | Upserts an all-default row if none exists |
| `PUT` | `/notifications/settings` | Partial update (reminders + quiet hours) |
| `POST` | `/notifications/devices` | `{ platform, pushToken, deviceName? }` — upsert per `(userId, pushToken)` |
| `GET` | `/notifications/devices` | |
| `DELETE` | `/notifications/devices/:id` | |
| `GET` | `/notifications/logs?limit=` | Recent delivery audit |
| `GET` | `/reports/daily?date=YYYY-MM-DD` | Aggregate day |
| `GET` | `/reports/weekly?from=&to=` | Aggregate range |
| `GET` | `/assistant/insights?limit=` | Active AI recommendations |
| `POST` | `/assistant/insights/:id/dismiss` | Dismiss |
| `POST` | `/ai/chat` | Auth-required AI chat (server-side provider) |

---

## Status codes

| Code | errorCode examples | When |
| --- | --- | --- |
| 200 | — | OK |
| 201 | — | Nest default on `POST` |
| 400 | `VALIDATION_FAILED`, `BAD_REQUEST` | Zod rejected body / bad query |
| 401 | `AUTH_INVALID_CREDENTIALS`, `AUTH_INVALID_REFRESH_TOKEN`, `AUTH_ACCOUNT_DISABLED`, `AUTH_UNAUTHORIZED` | Auth problem |
| 403 | `FORBIDDEN` | Not the owner |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `AUTH_EMAIL_TAKEN`, `CONFLICT` | Unique-key collision |
| 422 | `UNPROCESSABLE` | Business invariant (overpayment, endTime ≤ startTime, negative amount, etc.) |
| 429 | `RATE_LIMIT_EXCEEDED` | Throttler |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled; stack logged server-side only |

Full error-code catalog lives in [AUTH_FLOW.md](./AUTH_FLOW.md).
