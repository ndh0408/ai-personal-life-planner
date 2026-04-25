# Smart Check-ins — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/voice-companion/smart-checkin-settings.service.ts`, `apps/mobile/src/screens/voice/SmartCheckinSettingsScreen.tsx`, schema `SmartCheckinSetting`.

## 1. Why "ask, never assume"

Smart check-ins are scheduled notifications that PROMPT the user — they never observe the user's behavior in the background.

The contract is intentionally narrow:
- **The app sends a notification.**
- **The user opens the app and answers.**
- **A row is created from the user's answer.**

We do NOT infer "you're stressed" from anything other than what the user explicitly logs.

## 2. Five check-in types

Every type is independently togglable. Defaults: all five ON.

| Type | When | Asks |
|------|------|------|
| Morning check-in | `morningTime` (default 07:30) | sleep, energy, mood, today's important task |
| Meal check-in | breakfast / lunch / dinner windows | "did you eat?" + quick log |
| Evening review | `eveningTime` (default 21:00) | what got done, what slipped, mood at end of day |
| Sleep reminder | `sleepReminderTime` (default 22:30) | wind-down nudge + suggest reducing tomorrow's load |
| Finance check-in | configurable per user | today's expenses + budget status |

## 3. Backend contract

`GET / PUT /api/smart-checkins/settings` — owner-scoped, lazy defaults.

Times are stored as HH:mm strings. The dispatcher (v1.3) reads:
- the user's `UserProfile.timezone`
- the user's `NotificationSetting.quietHours{Start,End}` (already shipped)

So a 21:00 evening review for a Hanoi user respects their local 21:00 AND won't fire if it falls inside their quiet hours.

## 4. Privacy guarantees

- No background polling. The mobile app does NOT keep the foreground awake to "watch for the right moment".
- No notification body contains PII — they're literally "Time for your morning check-in?" type strings, locale-tagged.
- User can disable any one type without affecting the others.
- All five types respect the global `NotificationSetting.quietHours{Start,End}` set in privacy-tier notifications.

## 5. Manual test plan

1. Settings → Voice companion → Smart check-in settings → toggle Morning OFF → PUT round-trips.
2. Change `morningTime` to `08:15` → blur field → row updates.
3. (When dispatcher lands in v1.3) at 08:15 local time the morning notification fires; if 08:15 falls in quiet hours, it's suppressed.
4. Try `PUT /smart-checkins/settings` with invalid time `25:00` → 400 VALIDATION_FAILED.
