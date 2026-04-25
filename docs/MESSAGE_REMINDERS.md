# Message Reminders — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/communication/reminders.service.ts`, `apps/mobile/src/screens/communication/{FollowUpReminders,AddMessageReminder}Screen.tsx`.

## 1. The principle

LifeOS AI does **not** read messages from third-party apps. The Message Reminder feature is the user-friendly alternative: a manual "remind me to message X" surface that works for any app (Messenger / Zalo / iMessage / SMS / WhatsApp / Slack / etc.) without requiring sandbox-bypass tricks.

## 2. Two reminder kinds

| Kind | Anchored to | When | Status flow |
|------|-------------|------|-------------|
| `EmailReminder` | Optional `EmailItem` | After AI-suggest from triage OR manual creation from any inbox row | PENDING → SENT → DONE / DISMISSED |
| `MessageReminder` | None — free-form | Manual entry today; v1.3 may import from optional Android Notification Listener | PENDING → SENT → DONE / DISMISSED |

`MessageReminder.source` records origin (`MANUAL` / `AI_SUGGESTED` / `NOTIFICATION_IMPORT`). v1.2 only writes `MANUAL` from the mobile UI; the other two values land when those flows ship.

## 3. Privacy guarantees

- Backend never reads or stores message body content from any third-party app.
- The optional `MessageReminder.note` field is the user's own typing — kept verbatim.
- iOS will never gain notification-import capability — by Apple-API design.
- Android Notification Listener support is **off by default** and gated behind explicit OS-level enablement + the `androidNotificationImportEnabled` toggle. See `ANDROID_NOTIFICATION_IMPORT_RISK.md` for the full risk treatment.

## 4. Manual reminder UX

Mobile flow:

```
Settings → Communication → Follow-up reminders → Message tab → Add manual reminder
  ├── contactName         (optional)
  ├── platform            (optional, free-form: "Messenger" / "Zalo" / "SMS")
  ├── title               (required)
  ├── note                (optional, up to 2000 chars)
  └── remindAt            (ISO date-time string)
```

The form is intentionally minimal. v1.3 swaps the raw ISO field for a date-time picker.

## 5. Status transitions

```
PENDING ─┬─► DONE       (user marks complete)
         ├─► DISMISSED  (user dismisses without action)
         └─► SENT       (notification dispatcher fired the local reminder; v1.3 worker)
```

`PATCH /api/{email,message}-reminders/:id/status` accepts any of those transitions; the controller is owner-scoped.

## 6. Tests

Reminder ownership is enforced by `RemindersService.assertOwns{Email,Message}Reminder` — both throw `ForbiddenException` on cross-user access. Manual `EmailReminder` creation also asserts the optional `emailItemId` belongs to the same user.

## 7. Manual test plan

1. Add manual message reminder with title only → 201, appears in Message tab.
2. Mark it Done → status transitions, badge color changes.
3. Try `PATCH /api/message-reminders/:other-user-id/status` → 403.
4. Delete reminder → row gone, list refreshes.
