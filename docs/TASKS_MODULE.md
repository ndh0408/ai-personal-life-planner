# Tasks module — mobile

End-to-end CRUD surface for personal tasks, with filter + sort + search, optimistic complete, and two AI helpers that *suggest* but never mutate without explicit user confirm.

## Screens

### TasksScreen

Location: `apps/mobile/src/screens/tasks/TasksScreen.tsx`.

Structure:

- **Header** — title + `+ New` button (pushes `CreateTask`).
- **Search** — `TextInput` with clear button. Debounced at the keystroke level (server does the actual filter via `?q=`).
- **Filter chips** — `All · Today · Upcoming · Overdue · Completed`. See *Filter semantics* below.
- **Sort chips** — `Due date · Priority · Created`. Mapped to the server's `sortBy` param. Priority uses `sortDir=desc` (HIGH first), the other two use ascending order.
- **FlatList** of `TaskRow` with pull-to-refresh.
- **Empty state** keyed per-filter (`tasks.empty.ALL`, `tasks.empty.OVERDUE`, etc.).

### TaskRow

- Big round checkbox on the left (fires optimistic complete).
- Priority badge (LOW/neutral, MEDIUM/warning, HIGH/danger), optional category badge, overdue badge when due in the past.
- Title (strikethrough when completed), optional description line.
- Footer: dueDate (formatted via `formatDateByLocale`), `N min`, and the status label.

### CreateTaskScreen (create + edit)

Location: `apps/mobile/src/screens/tasks/CreateTaskScreen.tsx`.

- Accepts an optional `{ taskId }` route param (`RootStackParamList.CreateTask`). When present, it fetches the row via `tasksApi.get(taskId)` and seeds the form.
- Fields: title, description, dueDate (text; `YYYY-MM-DD HH:mm`), estimatedMinutes, category, priority chips.
- Validation through `@planner/shared.CreateTaskSchema` (zod + `@hookform/resolvers/zod`). Per-field error rendering.
- **Save** — POST (create) or PUT (edit), then invalidate `['tasks']` and `['dashboard']`, then `navigation.goBack()`.
- **Delete** (edit-only) — confirm dialog (title + body from i18n) → `DELETE /tasks/:id` → invalidate + back.
- **AI helpers** — two buttons in a bordered box:
  - *Break this down* → `POST /ai/chat` with `splitPrompt` that includes the task title + estimate. Shows the answer in a confirm dialog with `[Cancel] [Copy to description]`. Apply appends `\n\n[AI] …` so the user can edit before saving.
  - *Suggest a time* → `POST /ai/chat` with `timingPrompt`. Shown as read-only alert (just `OK`) so users pick the window themselves.
  - Both disabled while another AI call is in flight (`aiBusy`). Both require title length ≥ 3 — otherwise shows a localized "add a title first" alert.

## Filter semantics

`filter` drives both the server query (when it maps cleanly) and a client-side slice (for range-style filters the API doesn't expose in one call):

| Filter | Server query | Client post-filter |
| --- | --- | --- |
| `ALL` | everything | — |
| `TODAY` | `?dueDate=YYYY-MM-DD` | (no-op) |
| `UPCOMING` | everything | `dueDate > today + 24h` and `status ∉ {COMPLETED, CANCELLED}` |
| `OVERDUE` | everything | `dueDate < now` and `status ∉ {COMPLETED, CANCELLED}` |
| `COMPLETED` | `?status=COMPLETED` | — |

The search string is always forwarded to the server as `?q=` (server does case-insensitive contains on `title`).

## Optimistic complete

`completeMut` toggles status locally before the server responds:

1. `onMutate` cancels any in-flight `['tasks']` query and snapshots every task-list cache.
2. Each cache is patched with the toggled status + `completedAt` timestamp so the row re-renders immediately.
3. On error, **every** snapshot is rolled back and a localized alert shows.
4. `onSettled` invalidates `['tasks']` + `['dashboard']` so the authoritative row and dashboard counters refetch.

This is safe because the toggle is idempotent — if the server never sees the first tap, the second tap produces the same outcome.

## Query keys

```
QUERY_KEYS.tasks({ status, priority, category, dueDate, q, page, limit, sortBy, sortDir, filter })
['tasks', taskId]      // individual fetch in edit mode
['tasks']              // prefix used for bulk invalidation
```

Filter is part of the key so switching filters re-runs the query cleanly.

## Empty / loading / error states

- Initial fetch → `<Loading/>`.
- Fatal error on first load → `<ErrorView/>` with retry (shows the localized `errorCode`).
- List empty → `<EmptyState/>` with filter-specific description.
- Edit mode fetch error → `<ErrorView/>` with retry; form never loads with partial data.

## i18n

New key block `tasks.*` covers:

```
tasks.filter.{ALL,TODAY,UPCOMING,OVERDUE,COMPLETED}
tasks.sort.{dueDate,priority,createdAt}   tasks.sortBy
tasks.form.{title,description,dueDate,estimatedMinutes,category,priority,*Placeholder}
tasks.ai.{sectionTitle,split,timing,disclaimer,needTitleTitle,needTitleBody,
          splitPrompt,timingPrompt,splitTitle,timingTitle,copyToDescription}
tasks.confirmDelete.{title,body}
tasks.empty.{title,ALL,TODAY,UPCOMING,OVERDUE,COMPLETED}
tasks.overdue    tasks.min    tasks.createTitle    tasks.editTitle
```

Priority + status labels already existed (`tasks.priority.*`, `tasks.status.*`). Dates via `formatDateByLocale`.

## API calls

All JWT-guarded, all going through the typed `tasksApi`:

| Endpoint | Used by |
| --- | --- |
| `GET /api/tasks` | TasksScreen list (server sort + status/dueDate/q filters). |
| `GET /api/tasks/:id` | CreateTaskScreen edit-mode seed. |
| `POST /api/tasks` | CreateTaskScreen save (create). |
| `PUT /api/tasks/:id` | CreateTaskScreen save (edit). |
| `PATCH /api/tasks/:id/status` | Optimistic complete. |
| `DELETE /api/tasks/:id` | CreateTaskScreen delete. |
| `POST /api/ai/chat` | AI helpers — returns narrative text, never mutates data. |

## Testing

Manual walk-through (happy path):

1. Open Tasks tab → default filter `ALL`, sorted by dueDate asc. Seed data shows 4 tasks from the demo user.
2. Switch filter to `OVERDUE` → list only shows past-due, non-completed rows.
3. Type in search → the list re-fetches with `?q=`; clear-button resets.
4. Tap the round checkbox on a task → strikes through instantly; observe it persists after pull-to-refresh (server commit succeeded).
5. Flip airplane mode then tap checkbox → UI flips locally, then reverts on the server error with a localized alert.
6. Tap the task body → CreateTask opens with the form pre-filled; edit title + save → list re-fetches.
7. In edit mode, tap Delete → confirm dialog → row disappears from the list on back.
8. In create/edit mode, tap *Break this down* with no title → "Add a title first" alert; add a title → AI alert appears with `Copy to description` action that appends the suggestion.
9. Switch Settings → Language → retry every flow. All labels flip immediately.

## Why not a specialized "today tasks" endpoint?

The existing `GET /tasks?dueDate=YYYY-MM-DD` covers Today directly, and Upcoming/Overdue are thin derivations that don't justify a second endpoint. The dashboard already aggregates the *counts* the Today preview uses; TasksScreen pulls the full list when the user drills in. One endpoint, two layouts.
