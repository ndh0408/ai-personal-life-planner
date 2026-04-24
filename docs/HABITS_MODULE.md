# Habits module — mobile

Habit tracking end-to-end: list with filters, tap-to-check-in (with `+1` for multi-target habits), streak display, undo guard, and a create/edit screen with color + icon + frequency + target picker.

## Screens

### HabitsScreen

Location: `apps/mobile/src/screens/habits/HabitsScreen.tsx`.

- **Header** — `Habits` title + `+ New` button (pushes `CreateHabit`).
- **Filter chips** — `All · Today · Completed`.
  - *All* — every active habit.
  - *Today* — active habits whose today-count < target (i.e. still actionable).
  - *Completed* — active habits whose today-count ≥ target.
- **FlatList of HabitCards** with pull-to-refresh (refetches habits + today logs + 30-day logs in parallel).
- **Empty state** keyed per-filter:
  - `ALL` → "add 1–2 small ones to start"
  - `TODAY` → "All done for today!"
  - `COMPLETED` → "No check-ins yet today"

### HabitCard

- **Icon tile** — emoji picked on CreateHabit, background = `habit.color` at 33% alpha.
- **Name + frequency badge** — DAILY / WEEKLY / CUSTOM.
- **Streak badge** — rendered only when streak ≥ 1, shown as `🔥 N-day streak` (pluralized via i18n).
- **Description** line, optional.
- **Progress bar** — `count / targetCount × 100%`, green when complete, habit color otherwise.
- **Check-in button** on the right:
  - Target = 1 → "Check-in"; after complete flips to "Undo".
  - Target > 1 → "+1" that increments until target; after target flips to "Undo".

Tapping the card body (anywhere outside the check-in button) pushes `CreateHabit` in edit mode.

### CreateHabitScreen (create + edit)

Location: `apps/mobile/src/screens/habits/CreateHabitScreen.tsx`.

Accepts optional `{ habitId? }` route param (`RootStackParamList.CreateHabit`). When present, seeds the form by fetching the full habit list + picking the row (the server has no `GET /habits/:id` yet; the list fetch is cached + cheap).

Fields:

- `name*`, `description` (multiline)
- `frequency` — chips (DAILY / WEEKLY / CUSTOM)
- `targetCount` — numeric input; defaults to 1
- `color` — 6-swatch palette (`#22D3EE`, `#A78BFA`, `#F87171`, `#F59E0B`, `#10B981`, `#6366F1`) with a border ring on the selected one
- `icon` — 10-emoji grid (🔁 💧 🧘 💪 📚 🏃 🛏 🥗 💰 ✍️)
- `isActive` — toggle, **edit only**. Off = "pause without losing history".

Save → `POST /habits` or `PUT /habits/:id`, invalidate `['habits']` + `['habit-logs']` + `['dashboard']`, goBack.

Delete (edit only) → localized confirm dialog → `DELETE /habits/:id`. Confirm body warns that check-in history will be lost.

Validation via `@planner/shared.CreateHabitSchema` + zod resolver.

## Check-in logic

`checkInMut` chooses its payload based on direction:

```
{ habit, direction: 'up'   } →
    count = min(existingCount + 1, habit.targetCount)
    completed = count >= habit.targetCount
    POST /habits/:id/log { count, completed }

{ habit, direction: 'undo' } →
    POST /habits/:id/log { count: 0, completed: false }
```

The server's `log` handler is idempotent per `(habitId, date)` — it upserts the existing row rather than appending duplicates. That lets us:

- Tap check-in repeatedly on a multi-target habit without creating duplicate logs.
- Undo cleanly without a separate `DELETE` endpoint.
- Cross-device consistency: last-write-wins on the same day is fine because every client re-renders from the cached `/habits/logs?date=…` anyway.

## Streak computation

We run a single query `GET /habits/logs?from=30d-ago&to=today` at mount time (cached for 60s via `staleTime`), group by `habitId`, then for each habit walk backward from today counting consecutive completed days. Stops at the first missed day (today with no log yet doesn't break the streak).

Streaks > 60 days aren't accurately tracked on the home screen — the query window caps at 30 days and the walker caps at 60. For long-horizon views, the Reports module or an AI insight is a better surface.

## Query keys

```
QUERY_KEYS.habits                // ['habits']
['habits', habitId]              // edit-mode fetch (via list + pick)
['habit-logs', 'today']          // today's logs across all habits
['habit-logs', 'range-30']       // trailing 30 days, used only for streaks
['dashboard']                    // invalidated after check-in so
                                 // dashboard counters refresh
```

Mutations invalidate the union of the first four.

## AI touch-points (already wired at the assistant layer)

The Personal Assistant Engine emits recommendations for habits without a dedicated mobile UI to trigger them — the assistant's daily-monitoring service surfaces them automatically:

- **`HABITS_NOT_LOGGED`** (LOW) — every active habit skipped today.
- **`HABIT_DROPPING`** (MEDIUM) — daily habit ≤ 2/5 completions in the last 5 days.

These ride the existing recommendation feed on Dashboard + Assistant tabs. Product spec asks for "nếu habit bị bỏ nhiều ngày, tạo recommendation / gợi ý giảm target / đổi thời điểm" — the *generation* path is live; follow-up rounds can add an "Apply suggestion" handler that opens CreateHabit in edit mode with the target pre-lowered (today the Apply button just flips the recommendation to APPLIED, with the rationale in the body).

## API calls

| Endpoint | Used by |
| --- | --- |
| `GET /api/habits` | HabitsScreen list + CreateHabit edit seed. |
| `POST /api/habits` | CreateHabit save (create). |
| `PUT /api/habits/:id` | CreateHabit save (edit; supports `isActive`). |
| `DELETE /api/habits/:id` | CreateHabit delete. |
| `POST /api/habits/:id/log` | Check-in + undo (upsert on `(habit, date)`). |
| `GET /api/habits/logs?date=` | HabitsScreen — today rollup per habit. |
| `GET /api/habits/logs?from=&to=` | HabitsScreen — 30-day window for streak. |

Backend additions this round: `HabitLogsQuerySchema` gains optional `from`/`to` (YYYY-MM-DD); `HabitsService.listLogs` builds a `gte/lte` filter when they're present. Backward compatible — `?date=` still works as before.

## i18n keys

Extended `habits.*` namespace:

```
habits.title  addNew  createTitle  editTitle
habits.streak / streak_one / streak_other  todayLabel  plusOne  checkin  undo
habits.filter.{ALL,TODAY,COMPLETED}
habits.frequency.{DAILY,WEEKLY,CUSTOM}
habits.form.{name,namePlaceholder,description,descriptionPlaceholder,
             frequency,targetCount,color,icon,isActive,isActiveHint}
habits.empty.{ALL,TODAY,COMPLETED}.{title,description}
habits.confirmDelete.{title,body}
```

Pluralized keys use i18next's `_one` / `_other` suffix so Vietnamese renders "Chuỗi 5 ngày" and English renders "5-day streak" with proper grammar.

## Testing (manual)

1. Settings → Language → vi. Open Habits. Three demo habits (water × 8, meditation × 1, workout × 3/week) with partial 7-day history.
2. Filter `All` → see all three. Tap "+1" on Water → progress bar fills; 8th tap flips the button to "Undo".
3. Filter `Today` → completed-today habits disappear from the list.
4. Filter `Completed` → only the ones ≥ target today.
5. Pull to refresh — queries re-run in parallel, streaks recompute.
6. Tap a card → CreateHabit opens populated; change color/icon → Save → card re-renders with new visual.
7. In edit mode, tap Delete → confirm dialog → row disappears. Toggle `isActive` off → Save → row disappears from HabitsScreen (filter = active only) but stays in the DB.
8. Switch language → en. All labels flip including streak pluralization.
9. Airplane mode + tap check-in → localized error alert; UI reverts to previous state on the next refetch.
