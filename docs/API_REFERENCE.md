# API Reference — AI Personal Life Planner

Base URL: `http://localhost:3000/api`

## Conventions

### Auth
Every endpoint below requires `Authorization: Bearer <accessToken>`. Tokens come from
`POST /auth/login` (or `/auth/register`). The server reads the user id from the JWT —
**clients never send `userId` in the body or path**. All resources are scoped to the
caller and IDOR-protected at the service layer (404 if not found, 403 if owned by someone else).

### Response envelope
All non-error responses use:

```json
{
  "success": true,
  "data": <payload>,
  "message": "Human-readable summary"
}
```

Error responses use:

```json
{
  "success": false,
  "message": "What went wrong",
  "issues": [{ "path": "field.path", "message": "..." }],   // when Zod validation failed
  "statusCode": 400,
  "path": "/api/...",
  "timestamp": "2026-04-24T07:30:00.000Z"
}
```

### Pagination & filtering
Where supported: `?page=1&limit=20`. `limit` is capped at 100. List responses include
`{ items, total, page, limit, totalPages }` inside `data`.

### Date / time formats
- Date-only: `YYYY-MM-DD` (e.g. `2026-04-24`).
- Time-of-day: `HH:mm` (24-hour, e.g. `06:30`).
- Full timestamps: ISO-8601 (`2026-04-24T22:30:00.000Z`).

---

## Auth (existing)

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/auth/register` | `{email, password, name?, timezone?}` |
| `POST` | `/auth/login`    | `{email, password}` |
| `POST` | `/auth/refresh`  | `{refreshToken}` |
| `POST` | `/auth/logout`   | — (Bearer required) |

---

## Profile

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/profile` | Returns `{ profile, exists }`. `exists=false` and `profile=null` if not yet created. |
| `PUT` | `/profile` | Upsert. Creates the profile on first call, updates on subsequent calls. |

**Fields** (all optional except `fullName` on first creation):
`fullName`, `age (1–120)`, `gender`, `heightCm (50–260)`, `weightKg (20–400)`,
`occupation`, `workStartTime / workEndTime / usualWakeTime / usualSleepTime` (HH:mm),
`mainGoal` (`LOSE_WEIGHT|GAIN_WEIGHT|SLEEP_EARLY|PRODUCTIVE|STUDY|HEALTHY|BALANCE`),
`activityLevel` (`LOW|MEDIUM|HIGH`), `dietaryPreference`, `healthNotes`, `timezone`.

---

## Tasks

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/tasks` | List with filters. |
| `GET` | `/tasks/:id` | Single task. |
| `POST` | `/tasks` | Create. |
| `PUT` | `/tasks/:id` | Full update. |
| `PATCH` | `/tasks/:id/status` | `{ status }` only. Sets/clears `completedAt`. |
| `DELETE` | `/tasks/:id` | Hard delete. |

**Query** for `GET /tasks`:
`status`, `priority`, `dueDate=YYYY-MM-DD`, `category`, `q` (title contains, case-insensitive),
`page`, `limit`, `sortBy=createdAt|dueDate|priority|title`, `sortDir=asc|desc`.

**Body** for `POST/PUT`:
`title (1–200)`, `description?`, `priority` (`LOW|MEDIUM|HIGH`, default `MEDIUM`),
`dueDate?` (ISO datetime), `estimatedMinutes? (1–1440)`, `category?`.
`PUT` additionally accepts `status`.

**Body** for `PATCH /tasks/:id/status`: `{ status: TODO|IN_PROGRESS|COMPLETED|CANCELLED }`.

---

## Schedules (per-day)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/schedules?date=YYYY-MM-DD` | Returns the day's schedule with items, or `null`. |
| `POST` | `/schedules` | Create the day's schedule. 409 if one already exists for the date. |
| `PUT` | `/schedules/:id` | Update top-level fields. |
| `DELETE` | `/schedules/:id` | Cascades: removes the schedule's items. |

**Body fields**: `date` (POST only), `wakeUpTime / sleepTime` (HH:mm),
`summary`, `energyLevel` (`LOW|MEDIUM|HIGH`),
`mood` (`HAPPY|NORMAL|STRESSED|TIRED|SAD|MOTIVATED`),
`status` (`DRAFT|ACTIVE|COMPLETED|ARCHIVED`), `aiGenerated`.

---

## Schedule Items

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/schedules/:scheduleId/items` | Add an item to a schedule. |
| `PUT` | `/schedule-items/:id` | Update fields. |
| `PATCH` | `/schedule-items/:id/status` | `{ status }`. |
| `DELETE` | `/schedule-items/:id` | Remove. |
| `PATCH` | `/schedule-items/reorder` | `{ scheduleId, items: [{id, sortOrder}] }`. Atomic. |

**Item body**:
`title (1–200)`, `description?`, `startTime`, `endTime` (ISO), `type`
(`SLEEP|MEAL|WORK|STUDY|EXERCISE|REST|TASK|TRAVEL|CUSTOM`),
`priority?` (`LOW|MEDIUM|HIGH`), `reason?`, `sortOrder?`, `aiGenerated?`.
The service rejects `endTime <= startTime`.

**Status enum**: `PENDING | COMPLETED | SKIPPED | DELAYED`.

---

## Habits

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/habits` | List the caller's habits (active first). |
| `POST` | `/habits` | Create. |
| `PUT` | `/habits/:id` | Update. |
| `DELETE` | `/habits/:id` | Cascades: removes the habit's logs. |
| `POST` | `/habits/:id/log` | Upsert a log for the given date. |
| `GET` | `/habits/logs?date=YYYY-MM-DD&habitId=<uuid>` | List logs (optional filters). |

**Habit body**: `name (1–100)`, `description?`,
`frequency` (`DAILY|WEEKLY|CUSTOM`, default `DAILY`),
`targetCount (1–50, default 1)`, `color?`, `icon?`. `PUT` additionally accepts `isActive`.

**Log body**: `date?` (defaults to today), `completed? (default true)`,
`count? (0–50, default 1)`, `note?`. Idempotent per `(habit, date)`.

---

## Meals (one plan per day)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/meals?date=YYYY-MM-DD` | Returns the day's meal plan with suggestions, or `null`. |
| `POST` | `/meals` | Create. 409 if a plan already exists for the date. |
| `PUT` | `/meals/:id` | Update plan; if `suggestions` is provided the entire suggestion list is replaced atomically. |
| `DELETE` | `/meals/:id` | Cascades: removes its suggestions. |

**Plan body**: `date` (POST only), `goal?`, `budget?`,
`availableIngredients?: string[]`, `notes?`, `suggestions?: Suggestion[]`.

**Suggestion**: `mealType` (`BREAKFAST|LUNCH|DINNER|SNACK`),
`title (1–200)`, `description?`, `ingredients: string[]`,
`estimatedCalories?`, `prepTimeMinutes?`, `reason?`, `healthNote?`.

---

## Sleep logs

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sleep-logs` | Upsert per `(user, date)`. Server computes `durationMinutes` from `sleepTime`/`wakeTime`. |
| `GET` | `/sleep-logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | Range query (both bounds optional). |
| `PUT` | `/sleep-logs/:id` | Partial update. |
| `DELETE` | `/sleep-logs/:id` | Remove. |

**Body**: `date`, `sleepTime` (ISO), `wakeTime` (ISO),
`quality` (`VERY_BAD|BAD|NORMAL|GOOD|VERY_GOOD`), `note?`.
The service rejects `wakeTime <= sleepTime`.

---

## Mood logs

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/mood-logs` | Upsert per `(user, date)`. |
| `GET` | `/mood-logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | Range query. |
| `PUT` | `/mood-logs/:id` | Partial update. |
| `DELETE` | `/mood-logs/:id` | Remove. |

**Body**: `date`, `mood`, `energyLevel` (`LOW|MEDIUM|HIGH`),
`stressLevel` (`LOW|MEDIUM|HIGH`), `note?`.

---

## Health & AI (existing)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness ping (no auth). |
| `GET` | `/health/ready` | Liveness + DB ping (no auth). |
| `POST` | `/ai/chat` | Auth-required. Mobile **never** talks to the AI provider directly. |

---

## Status codes

| Code | When |
| --- | --- |
| 200 | OK (default for non-create endpoints) |
| 201 | (Nest default for `POST` — but the response envelope still uses `success: true`) |
| 400 | Validation failed (`issues[]` in the body) or business invariant violated |
| 401 | Missing/invalid Bearer token |
| 403 | Authenticated but resource owned by someone else (IDOR guard) |
| 404 | Resource not found |
| 409 | Unique-key conflict (e.g. duplicate `(userId, date)`) |
| 429 | Rate limited (global Throttler: 120 req / 60s by default) |
| 500 | Unhandled — logged with stack on the server |
