# LifeOS AI — Core Flows

Round 14. Five day-to-day flows, each ≤ 3 taps from Home. The rule across
all of them: smart defaults, optional fields collapsed, never trap the user.

---

## 1. Add task → finish task

```
HomeScreen → QuickAction "Task" ─▶ AddTaskScreen
                                     ├── title (autofocus)
                                     ├── priority chips: LOW / MEDIUM / HIGH
                                     └── due chips: none / today 9:00 / tonight 20:00 / mai 9:00
                                     [Lưu task]   [Huỷ]
                                          │
                                          ▼
TodayScreen list ◀──────────── TasksScreen (full list, today/week/month tabs)
   each row: [Xong]  [Xoá]
              │        │
              ▼        ▼
       PATCH complete  DELETE (soft)
```

Backend:

| Method | Path | Notes |
|---|---|---|
| GET    | `/api/tasks?range=today\|week\|month` | List + doneCount. |
| POST   | `/api/tasks` | `{title, priority?, dueAt?, description?}`. Defaults to MEDIUM / no due. |
| PATCH  | `/api/tasks/:id/complete` | Sets status=COMPLETED + completedAt=now. |
| PUT    | `/api/tasks/:id` | Partial update; `status` allowed. |
| DELETE | `/api/tasks/:id` | Soft delete (`deletedAt = now`). |

IDOR: every mutation calls `assertOwn(userId, id)` first → 404 if not yours
(intentionally indistinguishable from "doesn't exist").

---

## 2. Add expense → wallet adjusts → see in Money

```
HomeScreen / MoneyScreen → "+ Thêm chi tiêu" ─▶ AddExpenseScreen
                                                  ├── title (autofocus)
                                                  ├── MoneyInput (VND, grouped)
                                                  ├── category chips: food / transport /
                                                  │   shopping / health / learning / bills / other
                                                  └── note (optional)
                                                  [Lưu khoản chi]   [Huỷ]
                                                       │
                                                       │ POST /api/expenses
                                                       │   header: Idempotency-Key (per-mount UUID)
                                                       ▼
                                                Prisma $transaction:
                                                  (1) Expense.create
                                                  (2) Wallet.balance.decrement(amount)
                                                       │
                                                       ▼
                                                MoneyScreen invalidated
                                                  → today/week totals refresh
                                                  → wallet balance refreshes
```

| Method | Path | Notes |
|---|---|---|
| GET    | `/api/expenses?range=…` | List + totalAmount. |
| GET    | `/api/expenses/summary` | today/week/month + by-category. |
| POST   | `/api/expenses` | `Decimal(18,2)`. Header `Idempotency-Key` dedupes. |
| PUT    | `/api/expenses/:id` | If amount changes, wallet adjusts by the **delta** in the same tx. |
| DELETE | `/api/expenses/:id` | Soft delete + **refund** the wallet (`increment` by amount). |

Money rules:
- Amounts are `Decimal(18,2)` server-side. Mobile sends a plain integer (đồng).
- Default wallet auto-created if none exists. Other wallets via `POST /api/wallets`.
- Cross-user reads/writes blocked at the service layer; controllers carry no userId.

---

## 3. Log a meal

```
TodayScreen → "Sổ ăn uống" ─▶ MealLogScreen
                                ├── meal type chips (defaulted to current hour:
                                │     <10 → BREAKFAST, <14 → LUNCH, <17 → SNACK, else DINNER)
                                ├── title (autofocus, "Bạn ăn gì?")
                                └── cost MoneyInput (optional)
                                [Lưu bữa]
                                   │
                                   ▼ POST /api/meal-logs
                                Today list at the bottom refreshes inline.
```

| Method | Path |
|---|---|
| GET  | `/api/meal-logs?range=today\|week\|…` |
| POST | `/api/meal-logs` |

The old `/api/meals` GET stays for backward compatibility — both go through
the same `MealsService`.

---

## 4. Sleep + mood check-in (combined)

```
HomeScreen → QuickAction "Check-in" ─▶ SleepMoodCheckinScreen
                                         ┌─ SLEEP card ───────────┐
                                         │ chips: 5 / 6 / 6.5 /   │
                                         │   7 / 7.5 / 8 / 8.5h   │
                                         │ + "Bỏ qua" chip        │
                                         │ quality: BAD / OK /    │
                                         │   GOOD chips           │
                                         └────────────────────────┘
                                         ┌─ MOOD card ───────────┐
                                         │ mood chips:           │
                                         │   GREAT/GOOD/OK/      │
                                         │   TIRED/STRESSED/SAD  │
                                         │ energy chips:         │
                                         │   LOW/MEDIUM/HIGH     │
                                         │ note (optional)       │
                                         └───────────────────────┘
                                         [Lưu check-in]
                                              │
                                              ▼ Promise.all([
                                                  POST /api/sleep-logs (if hours set),
                                                  POST /api/mood-logs
                                                ])
```

Sleep window heuristic: anchor wakeAt at today 07:00 local, sleepAt = wake −
hours. Server validates `wakeAt > sleepAt` and computes durationMinutes.

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/sleep-logs?range=…`        | Range list. |
| GET  | `/api/sleep/latest`              | Single most recent. |
| POST | `/api/sleep-logs`                | `{sleepAtIso, wakeAtIso, quality?, note?}`. |
| GET  | `/api/mood-logs?range=…`         | Range list. |
| GET  | `/api/mood/latest`               | Single most recent. |
| POST | `/api/mood-logs`                 | `{mood, energy, loggedAtIso, note?}`. |

---

## 5. Wallets

```
GET  /api/wallets           list (default first)
GET  /api/wallets/default   default — auto-creates "Ví chính" if user has none
POST /api/wallets           {name, initialBalance?, currency?, isDefault?}
                            isDefault=true demotes any existing default first.
```

No DELETE yet — schema has soft delete (`deletedAt`) but balance
reconciliation across deleted wallets is a phase-2 problem.

---

## Cross-cutting rules

- **Auth**: every endpoint above requires a Bearer JWT. `userId` is sourced
  from the token claims, never trusted from the request body.
- **No IDOR**: each service helper does a `findUnique` + ownership check
  before any update/delete.
- **Decimal money**: `@db.Decimal(18, 2)` everywhere. Mobile sends int đồng;
  server wraps in `Prisma.Decimal` before write/delta.
- **Wallet sync**: every Expense write/update/delete is wrapped in a Prisma
  `$transaction([...])` together with the matching `Wallet.update`. Sum of
  expenses can never drift from `wallet.balance`.
- **Idempotency**: Expenses honour the `Idempotency-Key` header (unique on
  `[userId, idempotencyKey]`). Re-POSTing the same key returns the original
  row, no double-charge. Mobile generates a per-mount key in `useRef` so a
  rage-tap on "Save" still creates one row.
- **Soft delete**: Tasks + Expenses use `deletedAt` columns; lists filter
  on `deletedAt: null`. Wallets are also soft-deletable.
- **Empty / loading / error**: every list screen uses
  `LoadingState` → `EmptyState` → `ErrorState onRetry` from `components/ui`.
- **Pull-to-refresh**: TasksScreen, MoneyScreen, MealLogScreen pass a
  `RefreshControl` into AppScreen → ScrollView.
- **Confirm delete**: ConfirmModal with destructive variant on every
  hard-feeling action (task delete, expense delete).

---

## Verified end-to-end (round 14 smoke test)

```
demo@lifeos.local · seeded wallet balance 8 450 000 ₫

POST /api/tasks {Smoke task, HIGH}                          → 201
PATCH /api/tasks/:id/complete                               → status=COMPLETED
DELETE /api/tasks/:id                                       → soft-deleted

POST /api/expenses {Smoke cà phê, 75 000, food} +Idempotency-Key  → 201
GET  /api/wallets/default                                   → balance 8 375 000 ✓
POST /api/expenses (same key, replay)                       → same id ✓
PUT  /api/expenses/:id {amount: 100 000}                    → balance 8 350 000 ✓
DELETE /api/expenses/:id                                    → balance 8 450 000 ✓ (refund)

POST /api/meal-logs {Smoke phở 60k, BREAKFAST}              → 201
POST /api/sleep-logs {sleep 23:00 → wake 06:00, GOOD}       → durationMinutes 420 ✓
POST /api/mood-logs {GOOD, MEDIUM}                          → 201
```
