# Assistant Screen — mobile

The central surface for the proactive 24/7 life assistant. Pulls a single stateless "today" snapshot from the backend, renders it as a human-readable check-in, and lets the user act on proactive recommendations without any automatic side-effects. Tone is deliberately gentle, observational, never judgmental — recommendations are invitations, not instructions.

Location: `apps/mobile/src/screens/assistant/AssistantScreen.tsx`.

## Layout (top → bottom)

### 1. Header + refresh
Title + subtitle ("Watches your data and nudges at the right moment — without judgment.") with an inline `Refresh` action that re-runs the `assistant.today` query.

### 2. Today Summary card
A single human sentence generated client-side from the snapshot. The `buildHeadline()` helper picks the most useful line to lead with, prioritizing real signals over a generic greeting:

1. `HIGH`-priority active recommendations → "{{count}} things are worth your attention today."
2. Rising spending category → "{{category}} spending has crept up this week — worth a glance." / "Chi tiêu {{category}} tuần này hơi cao — nên xem qua."
3. Overloaded days detected → "{{count}} overloaded days ahead — consider easing one item."
4. `MEDIUM` active recs → "{{count}} gentle suggestions waiting — no rush."
5. Any other recs → "{{count}} suggestions worth a look."
6. Otherwise → "You're on track today — nothing urgent." / "Hôm nay bạn đang đi đúng tiến độ."

Under the headline we show quick badge counters: active recs, high-priority count (only if > 0), overloaded days (only if > 0).

### 3. Assistant Actions card
Two buttons:
- **Run daily monitoring** → `POST /api/assistant/run-daily-monitoring`. Invalidates `['assistant']` on success so the snapshot refreshes in-place. Safe to call repeatedly — the backend has a 24h dedupe per signal code.
- **Generate daily review** → `POST /api/assistant/generate-daily-review { date: today }`. On success, we show a 3-block Alert (summary + wins + tomorrow's suggestions) with an "Open full review" button that pushes `DailyReview` for the complete screen.

Both mutations surface failures via `useErrorMessage()` so the localized error copy matches the rest of the app.

### 4. Filters
Two chip rows:
- **Type filter** (`Area` in VN): `ALL + SCHEDULE / TASK / HABIT / MEAL / HEALTH / FINANCE / GOAL`. Because the backend uses a finer-grained `AIRecommendationType` enum (`SCHEDULE | TASK | HABIT | MEAL | SLEEP | HEALTH | FINANCE | BUDGET | GOAL | GENERAL`), the mobile client collapses a few of them for the filter UI: `SLEEP → HEALTH`, `BUDGET → FINANCE`, `GENERAL → TASK`. The mapping lives in `TYPE_TO_GROUP` at the top of the screen so it's easy to adjust.
- **Priority filter**: `ALL + HIGH / MEDIUM / LOW`.

The filtered list drops recommendations whose status is `APPLIED` or `DISMISSED` — those are already closed out. `NEW` and `VIEWED` both remain visible (the only difference is a subtle `New` badge).

### 5. Recommendation rows
Each row is a `Card` with:
- Type + priority badges, plus a `New` info badge when the server hasn't seen the user engage with it yet.
- Title (bold) + content (muted) + createdAt (date + time, locale-aware).
- Four action pills: `View`, `Apply`, `Ask AI`, `Dismiss`.

**View** — shows an Alert with the full title + content, with an "Open" button that navigates to the relevant screen (`Tasks`, `Habits`, `Meals`, `Health`, `PersonalGoals`, or back to `Main` for schedule/finance). Side-effect: flips `NEW → VIEWED` so the "active" count reflects reality.

**Apply** — opens a confirm Alert first ("Mark as applied? I won't change anything automatically — I'll just remember you've handled this one."). Only after user confirms do we `PATCH /api/assistant/recommendations/:id/status { status: APPLIED }`. Nothing in the user's actual data (tasks, wallets, budgets…) is mutated — the button is a bookmark, not an auto-action. This is the product's hard rule: the assistant never self-applies changes.

**Ask AI** — routes to `POST /api/ai/chat` with a localized prompt that asks for a short, gentle explanation of why the recommendation was made and 1-2 small actions for today. The reply is rendered as an Alert. Also flips `NEW → VIEWED`.

**Dismiss** — single-tap `PATCH … { status: DISMISSED }`. No confirm because the action is reversible server-side (status can flip back).

### 6. Behavior patterns card
Supporting context at the bottom: best-hour bucket, best habit, slipping habit, 14-day overloaded-day count. Purely informational, no actions.

## Local notifications for HIGH priority

On every snapshot refresh we diff incoming `recommendations` against a component-scoped `Set` of already-notified ids. Any `HIGH` priority rec with status `NEW` or `VIEWED` that the user hasn't been notified about yet triggers a local notification via `expo-notifications`:

```ts
Notifications.scheduleNotificationAsync({
  content: { title: rec.title, body: rec.content, data: { recommendationId, type } },
  trigger: null,
});
```

The effect silently no-ops if permissions were declined — nothing blocks the UI. The dedupe `Set` lives in a `useRef` so it survives re-renders but resets when the screen unmounts (which is what we want: re-notify once per session, not on every render).

## Non-pressuring tone guarantees

- Headlines default to observation, not command ("spending has crept up", not "you overspent").
- All priority labels are neutral enum names, not shouty ("Needs attention", not "⚠️ URGENT").
- Confirm-before-apply dialog explicitly says "I won't change anything automatically" so users know the assistant is never acting behind their back.
- AI prompt for "Ask AI" asks the model for a *gentle* explanation — see `assistant.ai.askPrompt` in both locales.
- Empty state reads "Nothing to suggest right now … no pressure." / "Hiện chưa có gợi ý nào … không áp lực."

## API surface used

```
GET    /api/assistant/today                         // snapshot: signals + scores + recs + patterns
GET    /api/assistant/recommendations               // (not used on this screen; snapshot includes recs)
PATCH  /api/assistant/recommendations/:id/status    // flip NEW / VIEWED / APPLIED / DISMISSED
POST   /api/assistant/run-daily-monitoring          // rerun orchestrator; respects 24h dedupe
POST   /api/assistant/generate-daily-review         // daily-review AI payload
POST   /api/ai/chat                                 // Ask AI action
```

## Query-key map

```
['assistant']           // umbrella — invalidated after any mutation on this screen
['assistant', 'today']  // snapshot
```

Mutations (`runDailyMonitoring`, `patchStatus`) invalidate the `['assistant']` prefix so both the snapshot and any other assistant-dependent views refetch. `generateDailyReview` does **not** invalidate — its result is transient and shown once in an Alert + via the separate `DailyReview` screen.

## i18n coverage

New keys added to both `vi.json` and `en.json`:

- `assistant.summary.*` — check-in title + headline variants + badge counters (pluralized: `_one` / `_other` + fallback).
- `assistant.actions.*` — run-daily / generate-review labels + body.
- `assistant.filters.{type,priority,all}`.
- `assistant.type.{SCHEDULE,TASK,HABIT,MEAL,HEALTH,FINANCE,GOAL}` — the grouped labels used on chips + row badges.
- `assistant.priority.{HIGH,MEDIUM,LOW}` — filter chips + row badges (separate from `tasks.priority.*` because the assistant uses its own phrasing).
- `assistant.badge.new`.
- `assistant.action.{apply,dismiss,view,open,askAi}`.
- `assistant.confirmApply.{title,body}`.
- `assistant.ai.{askPrompt,answerTitle}`.
- `assistant.review.{doneTitle,openFull}`.
- `assistant.empty.{title,description}` — softened to "no pressure" tone.

## Testing (manual)

1. Settings → Language → vi. Open Assistant tab. Seed data: 6 active recommendations across types, 1 with priority HIGH.
2. Expect the Today Summary headline to read "Có 1 việc đáng để chú ý hôm nay." and the HIGH-priority badge to show under it.
3. Grant notification permission on first launch → receive a system notification with the HIGH-priority rec's title + content.
4. Tap "Chạy kiểm tra hôm nay" → spinner → snapshot refreshes with any new recs.
5. Filter row: pick `Tài chính` → list narrows to FINANCE + BUDGET recs. Pick priority `Cao` → narrows further to just HIGH.
6. Tap `Xem` on a HEALTH rec → Alert shows title+content → "Mở" navigates to Health screen.
7. Tap `Áp dụng` on a rec → confirm Alert with the "không tự đổi gì hết" copy → confirm → rec disappears from the active list (status now APPLIED).
8. Tap `Hỏi AI` → receive a short Vietnamese explanation in an Alert; rec flips from "Mới" badge → no badge.
9. Tap `Bỏ qua` on a rec → disappears silently.
10. Tap "Tạo review cuối ngày" → Alert with summary/wins/tomorrow → "Mở review đầy đủ" → pushes `DailyReview`.
11. Switch language to en → every label + headline + filter chip flips.
