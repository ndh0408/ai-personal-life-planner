# Notification Dispatcher

Round 12 built the dispatcher → queue → worker → Expo push pipeline. Before
Round 12, `NotificationLog` rows accumulated as `PENDING` forever because no
component drained them.

## Pipeline

```
caller → NotificationDispatcherService.dispatch(input)
            ├─ INSERT NotificationLog(status=PENDING, idempotencyKey?)
            └─ QueueService.enqueue('notification-queue', 'send-notification', { logId })
                       │
                       ▼
                NotificationWorkerService.handle(job)
                  ├─ load NotificationLog + user.notificationSetting + active devices + profile
                  ├─ skip if setting disabled this type      → status=CANCELLED
                  ├─ skip if no active devices               → status=CANCELLED
                  ├─ defer if inside quiet hours (per tz)    → throw → BullMQ requeues
                  ├─ render template under user's locale (vi/en)
                  ├─ POST to ExpoNotificationProvider for each device
                  ├─ deactivate device if response code is INVALID_TOKEN
                  └─ status=SENT | FAILED | (retry on transient)
```

## Idempotency

`NotificationLog` has a `(userId, idempotencyKey)` unique index. Any caller
that wants dedupe within a window passes `idempotencyKey`. Examples:

- Daily review nudge: `idempotencyKey: 'daily-review:${YYYYMMDD}'`
- Recommendation push: `idempotencyKey: 'rec:${recommendationId}'`

A second `dispatch()` with the same key returns the existing log id
(`{ id, deduped: true }`); no second job is enqueued.

## Quiet hours

Resolved at SEND time (not dispatch time) so a user can change their setting
between dispatch + delivery.

- `quietHoursStart` / `quietHoursEnd` are stored as `@db.Time(0)` (no date)
  in UTC.
- The worker computes "now" in the user's `profile.timezone` via `Intl`.
- Wrap-around windows (e.g. 22:00 → 07:00) are supported.
- When in quiet hours, the worker throws `quiet_hours_defer:<ms>`; BullMQ
  retries per `defaultJobOptions` after the configured backoff. (The
  notification is **deferred**, not dropped.)

## Provider abstraction

`NotificationDeliveryProvider` is the interface; `ExpoNotificationProvider`
is the default. Future providers (APNs/FCM direct, Twilio for SMS) implement
the same shape. The worker depends only on the interface.

### Dry-run

`EXPO_PUSH_DRY_RUN=true` (or `NODE_ENV=test`) makes the provider log
metadata only and return a synthetic `id`. The pipeline is exercised end-to-
end without real outbound traffic — used by jest specs.

## Privacy + log redaction

- Log lines never include the push token, the user-facing body, the
  payload, or the user id beyond the first 8 chars (e.g. `to=ExponentP…`).
- `NotificationLog.title` / `body` are kept (they're already user-facing
  strings) but never re-logged.

## Setting matrix

`notification-worker.service.ts` maps notification `type` → `NotificationSetting`
field:

| Type | Setting field |
|--|--|
| `reminder.task` | `taskReminder` |
| `reminder.habit` | `habitReminder` |
| `reminder.meal` | `mealReminder` |
| `reminder.sleep` | `sleepReminder` |
| `reminder.mood` | `moodCheckinReminder` |
| `finance.budget_alert` | `budgetAlert` |
| `goal.progress` | `goalReminder` |
| `assistant.nudge` | `assistantNudge` |
| `recommendation.high` | `assistantNudge` |
| `recommendation.daily` | `assistantNudge` |
| (unmapped) | (always allowed) |

## Tests

`notification-dispatcher.service.spec.ts`:
- writes a PENDING log + enqueues a job
- dedupes on idempotencyKey
- log row still written when queue is disabled

`notification-worker.service.spec.ts`:
- per-type setting honoured
- unmapped types fall through
- recommendation.* mapped to assistantNudge
- quiet hours reachability + ms-until-end calc

## Operations

- Backlog: `/health/ready` → `queues['notification-queue']`.
- Dead-letter: BullMQ keeps the last 5000 failed jobs for 7 days
  (configurable in `QueueService`). Use the BullMQ UI or
  `Queue.getFailed()` to inspect.
