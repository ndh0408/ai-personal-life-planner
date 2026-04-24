# TodayScreen

The operating surface of the user's current day — timeline + live actions + AI planner controls + a glanceable view into tasks, habits, meals, and finance for context. Lives at `apps/mobile/src/screens/today/TodayScreen.tsx` and is accessible both as the Today bottom tab and via "Open plan" from the Dashboard.

## Data sources

Two parallel React Query reads:

- `GET /api/schedules?date=YYYY-MM-DD` — authoritative schedule + items for the day. Key: `QUERY_KEYS.schedule(date)`.
- `GET /api/dashboard/summary` — the same aggregate used by Dashboard, here only for the preview cards (tasks, habits, meals, finance) so Today doesn't fan out to 5 more endpoints. Key: `['dashboard', 'summary']`.

Pull-to-refresh runs both refetches in parallel. Any mutation that affects the schedule or dashboard preview invalidates both query keys.

## Sections

1. **Header** — formatted date + large title + mood/energy card. If the user has logged mood today we show the current values; otherwise a prompt to check in. `Check-in` button pushes the `SleepMoodCheckin` modal.
2. **AI Planner card** — schedule summary (when present) or a description when not. Two actions: "Generate" / "Regenerate" (fires `POST /ai/generate-schedule`) and "I'm running late" (fires `POST /ai/reschedule`). Both spam-guarded: `isPending` disables the buttons and flips the label to "Generating…" / "Re-planning…".
3. **Wake/Sleep card** — two compact cards with the `wakeUpTime` + `sleepTime` from the schedule. Hidden entirely when no schedule exists.
4. **Timeline** — existing `<TimelineItem/>` per `ScheduleItem`, followed by a row of action chips (`Mark done` / `Undo`, `Skip`, `Delay`). Empty state when `items.length === 0`.
5. **Task preview** — pulls from the dashboard payload. 3 stat tiles (today completed/total, overdue, high priority) + top 3 tasks with priority badges. "View more" → Tasks screen.
6. **Habits preview** — `x/y habits checked today` + 7-day consistency %. "View more" → Habits.
7. **Meals preview** — `x/y meals logged` + next planned suggestion. "View more" → Meals.
8. **Finance reminder** — remaining cash this month + up to 2 active budget warnings. "View more" → Finance tab.

## AI planner flow

```
Tap "Generate" / "Regenerate"
          │
          ├─ If no schedule today → fire POST /ai/generate-schedule
          │                        immediately.
          └─ If a schedule already exists → Alert with
             "Overwrite today's plan?" [Cancel] [Generate].
             Only Cancel / Generate dismisses the dialog; double-taps
             on "Generate" are blocked by the `isPending` guard.
On success:
  - invalidate QUERY_KEYS.schedule(date)
  - invalidate ['dashboard'] (summary counters may have shifted)
On error:
  - localized Alert using useErrorMessage()
  - the existing schedule (if any) stays visible — we never clear state
    preemptively.
```

"I'm running late" is a 2-step preview/commit:

1. `POST /ai/reschedule` with `{ date, currentTime, delayMinutes: 30 }`.
2. Alert with the preview summary + counts of shortened/removed items and `[Cancel] [Apply]`.
3. On Apply → `POST /ai/apply-reschedule` with the cached `previewId`, then invalidate the schedule query.

The "I'm running late" button is disabled when there's no schedule, when offline, or when another AI mutation is already in flight.

## Offline handling

`useOnline()` polls `GET /api/health` every 45 s (and on AppState `active`). When the probe fails:

- Banner at top of the screen (amber) showing `offline.title` + `offline.description`.
- Both AI buttons are disabled.
- Local reads still render from the React Query cache so the user sees their latest timeline.

The banner uses theme colors + warning tone; never blocking and never modal.

## Spam / double-tap guards

- `generateMut.isPending` disables both AI buttons and changes their label.
- `rescheduleMut.isPending` disables both AI buttons (we only allow one AI mutation at a time since they can affect the same DailySchedule row).
- `requestGenerate()` short-circuits before dispatching when `generateMut.isPending` is already true.
- Item action chips (`Complete`, `Skip`, `Delay`) fire `setStatusMut` without a local debounce — the mutation is idempotent at the server and invalidates the cache, so a rapid sequence of taps collapses correctly.

## Loading / error / empty

- Initial load (no cached data) → `<Loading/>`.
- Fatal error on first load → `<ErrorView/>` with retry.
- Timeline empty → `<EmptyState/>` pointing at the Generate action.
- Mood not logged → inline prompt.
- Finance budgets empty → just the "remaining this month" line.
- Refetching after pull-to-refresh keeps the previous render visible (no flash).

## i18n

All labels route through `t()`. New key namespaces in this round:

- `today.*` — headers, AI planner copy, reschedule preview labels, wake/sleep labels, section titles, empty state, preview lines.
- `today.item.*` — complete / undo / skip / delay chip labels.
- `offline.*` — banner copy.

Money via `formatMoneyByLocale(amount, currency)`. Dates via `formatDateByLocale(date)`. Times via `formatTimeOfDay(value)` (HH:mm, locale-agnostic).

## Testing vi/en

Manual smoke (no automated UI test for this screen yet):

1. Settings → Language → **vi** → open Today. Expect all labels in Vietnamese; the AI planner header reads "AI Planner", action button "Tạo lịch hôm nay" / "Tôi bị trễ"; empty state "Chưa có lịch hôm nay".
2. Settings → Language → **en** → re-open Today. Same content switches to "Generate today" / "I'm running late" / "No plan for today yet". Tab bar labels also flip (they use `t()` in `MainTabsNavigator`).
3. Toggle airplane mode → offline banner appears within 45 s; AI buttons dim. Re-enable → banner disappears on the next probe.
4. With a schedule present, tap Generate → overwrite confirmation alert uses the current locale.
5. Item chips: tap "Mark done" on an item → timeline re-renders with strike-through + dashboard counter bumps.

## Query-key cheat sheet

```
QUERY_KEYS.schedule(date)   // ['schedules', date]
['dashboard', 'summary']    // same key dashboard uses

// After a schedule mutation (status change, regenerate, apply-reschedule):
queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) });
queryClient.invalidateQueries({ queryKey: ['dashboard'] });
```

## Why not a dedicated "today" aggregate endpoint?

The schedule already exists at `/schedules?date=`, and `/dashboard/summary` already has every preview tile Today needs. Adding `/today/summary` would duplicate fields + lock the two screens together. The current split keeps Today fast (one network call for the live schedule + one shared cache hit for the previews) without introducing a third aggregate.
