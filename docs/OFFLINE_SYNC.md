# Offline cache + sync — mobile

Three services working together so the app stays useful on airplane mode and recovers cleanly when the network returns. No magic, no optimism beyond what the user has already authorized.

## Services

### `NetworkStatusService` (`services/offline/network-status.ts`)

Single source of truth for "are we online to our API?". Implemented as a `/health` probe rather than the OS link status because a WiFi link can be up while our server is unreachable (DNS, VPN, firewalled hotel WiFi).

- Polls every 45 s + re-probes on app-active.
- Exposes `networkStatus.get()` (sync), `networkStatus.subscribe(fn)` (push), `networkStatus.markOffline()` (called by mutation helpers after a raw network error so the banner flips without waiting for the next poll).
- `useOnline()` is a thin React hook over this service so existing call sites keep working.

### `CacheService` (`services/offline/cache-service.ts`)

Write-through persistence layer for React Query. Whitelist-based — only the queries that actually need to render offline.

- **Whitelist** (by first element of the query key): `profile`, `dashboard`, `schedules`, `today`, `tasks`, `habits`, `meals`, `health`, `sleep-mood`, `wallets`, `incomes`, `expenses`, `budgets`, `debts`, `saving-goals`, `goals`, `assistant`, `reports`.
- **Language setting** lives under its own AsyncStorage key (`lifeos.locale`), owned by the i18n init path — not duplicated here.
- `hydrate(qc)` at boot: reads all whitelisted entries and calls `queryClient.setQueryData` so screens render cached snapshots before any network request.
- `wire(qc)`: subscribes to `QueryCache` and persists any *successful* whitelisted result.
- `purge()` wipes everything on logout.

### `SyncQueueService` (`services/offline/sync-queue.ts`)

Durable FIFO queue of pending writes captured while offline. Persisted to AsyncStorage so the queue survives app restarts and airplane mode.

Supported action kinds today:
- `task:setStatus` — complete / uncomplete a task.
- `habit:log` — +1 habit check-in or undo.
- `expense:create` — simple expense add (no wallet-balance optimism).

Future kinds plug in by adding a discriminated-union member + a `perform()` case — the persistence layer doesn't care.

Public surface:
```ts
syncQueue.enqueue(action)                 // add to queue
syncQueue.flush(qc)                       // drain queue; called on reconnect
syncQueue.runOrQueue(action, runOnline)   // try online first; fall back on network fail
syncQueue.subscribe(fn)                   // for the banner's pending count
syncQueue.purge()                         // wipe on logout
```

## Integration

### Boot (`App.tsx`)

```ts
await initI18n();
await bootOfflineServices(queryClient);   // hydrate → wire → start probe → reconnect listener
configureNotifications();
```

`bootOfflineServices` wires the reconnect listener too: whenever the probe flips from offline to online, it calls `syncQueue.flush(qc)` and then `queryClient.invalidateQueries()` so every screen refetches the server-authoritative state.

### Banner (`components/ui/OfflineBanner.tsx`)

Mounted once in `RootNavigator` above the stack. Two modes:
- **Offline** (amber): "You're offline — showing cached data." / "Đang ngoại tuyến — đang hiển thị dữ liệu đã lưu."
- **Syncing** (primary color): shows while the queue is draining after reconnect, with a pluralized count.

Hidden when online + queue empty. No dismiss button — the banner *is* the state.

### Offline-capable mutations

Wired through `syncQueue.runOrQueue` in three places:

1. **`TasksScreen`** — `completeMut.mutationFn`. The existing optimistic snapshot-rollback still runs, so the UI flips instantly whether the network succeeds or we queue. On reconnect, the queue is replayed; if the task was deleted server-side, the 4xx causes the queued action to drop silently (local-complete-wins-if-item-exists).
2. **`HabitsScreen`** — `checkInMut.mutationFn` for both +1 and undo.
3. **`AddExpenseScreen`** — on save. On queue, the user sees a localized "Saved for later" alert and the modal closes. The cache is invalidated so the next refetch picks up the new expense once the queue syncs. We don't optimistically write the expense row locally — the wallet-balance adjustment is server-side-transactional and we want the next refetch to be the source of truth. (Form state is preserved on non-network errors, so a validation 4xx doesn't wipe what the user typed.)

### AI gating

All AI calls route through `aiApi.*` (and `assistantApi.generateDailyReview`, `generateWeeklyReview`, `runDailyMonitoring`). Each method preflights `assertOnlineForAi()` which throws a `OfflineAiBlocked` sentinel when the probe is red.

- The sentinel has `errorCode: 'AI_OFFLINE'`; `useErrorMessage` maps it to the localized `offline.ai.blockedBody` string.
- Every screen that already routes errors through `translateError(e)` — Today, Assistant, Reports, AI Chat, Goal Detail, Create Task, Meals — therefore shows the correct localized message without per-screen changes.
- `services/offline/ai-gate.ts` also exports `requireOnlineForAi()` for call sites that want to *guard before starting* (instead of catching after).

## Conflict strategy

| Scenario | Strategy |
| --- | --- |
| Complex records (goals, schedules, profile, budgets, debts, meals, etc.) | Server wins. Those mutations require online; offline attempts surface a localized "You need to be online" via the existing translate-error pipeline (`errors.NETWORK`). |
| Task status, habit check-in | Local complete wins — **if the item still exists server-side**. On reconnect, the queue replays; a 404/4xx drops the action silently. |
| Pending expense | Synced by temp id — the queue action carries a `tempId` (prefixed `pending:`) so a future UI could tag the row. Server generates the real id when the create succeeds. On 4xx rejection, the queued entry is removed and the cache invalidates so the temp row disappears. |

## Not losing form data

- `AddExpenseScreen` + any Create screen only closes on success *or queued*. If the request throws a non-network error (validation 4xx), form state stays put and the Alert just surfaces the localized message — the user can fix + retry.
- `syncQueue.runOrQueue` converts raw network failures into queued actions, so the form closes rather than trapping the user behind a broken button on spotty networks.

## Logout

`useAuthStore.logout()` now calls `resetOfflineState()` after clearing tokens: cache purge + queue purge. The next user starts clean.

## Storage keys

```
offline:cache:<json-query-key>   // CacheService write-through
offline:sync-queue               // SyncQueueService persisted queue
lifeos.locale                    // owned by i18n init, NOT this module
auth.access / auth.refresh       // owned by tokenStore via SecureStore
```

## Testing (manual)

### Airplane mode
1. Open app, log in on a live network. Navigate Dashboard → Tasks → Habits → Finance so those queries populate.
2. Turn on airplane mode. Wait ~15 s for the probe to flip.
3. Banner shows "You're offline — showing cached data." The four screens still render because React Query reads the in-memory cache + the hydrated snapshot.
4. Navigate AI Chat → type a message → send. Expect localized "AI is offline" alert (no network call attempted).
5. Tap "Generate today's review" on DailyReview → same alert.
6. On Tasks, complete 2 tasks. Each flips visually (optimistic). On Habits, tap `+1` twice. On Finance → `+ Add expense`, fill and save → "Saved for later" alert, modal closes.
7. Close + reopen the app while still in airplane mode — the three pending actions remain queued (banner shows the syncing copy when you land, then re-shows offline until you reconnect).

### Reconnect
1. Turn airplane mode off.
2. Within ~45 s (or immediately on app-active) the probe flips. Banner briefly shows "Syncing N pending actions…" → disappears.
3. Refetch the server via pull-to-refresh on Tasks/Habits/Finance — the 2 completed tasks stay completed, the habit logs show, the expense is on the list with its server id, the wallet balance has adjusted.
4. Open Monthly Finance report (online) → AI analyze works.
5. Logout → cache + queue purged → log back in as another user → see only their data.

## i18n keys

```
offline.banner.{offline, syncing, syncing_one, syncing_other}
offline.ai.{blockedTitle, blockedBody}
offline.queued.{title, expenseBody, taskBody, habitBody}
```

Existing `offline.{title, description}` keys stay for any full-screen offline view.
