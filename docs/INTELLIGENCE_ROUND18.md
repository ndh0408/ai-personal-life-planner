# LifeOS AI — Round 18: Full intelligence upgrade

User feedback after rounds 15-17: "AI chưa thông minh, chưa hiểu được chủ
nhân cần gì." Round 18 rebuilds the intelligence layer so every AI feature
sees the same wide UserContext and learns from the user over time.

> Backend: `apps/api/src/modules/intelligence/`
> Schema: `UserBehaviorSummary`, `EventLog`, `AssistantMemory` + 5 new
>   `UserProfile` columns (`dislikes`, `allergies`, `monthlyGoal`,
>   `workPattern`, `budgetMonthly`).
> Mobile: `PreferencesScreen`, `MemoryScreen`, `SmartNudges` component,
>   👍/👎 feedback on insight cards.

---

## What was wrong

1. **Snapshot too thin** — planner only saw 7-day sleep + last mood + recent
   meals + 1 expense category. No behaviour patterns, no event history, no
   user-declared preferences.
2. **Plan = static** — generated once, never adapts to mid-day signals.
3. **No memory** — each chat had only its own conversation history. AI
   forgot facts the user had told it last week.
4. **No declared preferences** — onboarding only asked goals + wake/sleep.
   No place to say "I'm allergic to peanuts" or "I save 5M this month".
5. **No feedback loop** — skipping a plan item didn't influence the next
   plan; user edits weren't recorded.
6. **Recommendations = 5 hardcoded rules** — same nudges for everyone.

## What round 18 does

### Schema (3 new tables, 5 new columns)

```prisma
model UserProfile {
  // ...existing
  dislikes      Json     @default("[]")
  allergies     Json     @default("[]")
  monthlyGoal   String?
  workPattern   String?     // 'morning' | 'evening' | 'night-owl' | 'flexible'
  budgetMonthly Decimal? @db.Decimal(18, 2)
}

model UserBehaviorSummary {
  // 24-bucket wake/sleep histograms, 7-element avg sleep by weekday,
  // peak focus window (2-5h post-wake), top 5 expense categories with
  // weekly amounts, recent 10 meal titles, mood↔sleep Pearson correlation,
  // task completion rate by priority. 1 row per user.
}

model EventLog {
  // Append-only stream: CAPTURE_PARSED/CONFIRMED/EDITED, PLAN_ITEM_DONE/
  // SKIP/EDITED, INSIGHT_LIKED/DISMISSED, TASK_COMPLETED/DELETED.
  // The AI reads the most recent 30 to know "what just happened".
}

model AssistantMemory {
  // Long-term facts extracted by an LLM job after each chat turn:
  // "user prefers cơm gà over phở", "user works night shifts".
  // weight 0.5 by default, bumped on user confirm, top 10 injected into
  // every subsequent system prompt.
}
```

### Intelligence module (new `apps/api/src/modules/intelligence/`)

- **`EventLogService`** — `log(userId, kind, summary, payload)`. Best-effort
  write, never throws.
- **`BehaviorService`** — `get(userId)` returns cached summary if < 1h old,
  else recomputes from 90 days of history. `recompute(userId)` forces a
  refresh (called after sleep / expense / income confirms).
- **`AssistantMemoryService`** — `top(N)`, `list()`, `forget(id)`,
  `confirm(id)` (bump weight), `extractAndStore(userId, convId, turns)`
  (LLM extraction).
- **`UserContextService.build(userId)`** — the **single function** every AI
  feature calls before sending anything to OpenAI. Returns:
  ```ts
  {
    now, tz,
    profile: {preferredName, mainGoals, usualWakeTime, usualSleepTime,
              dislikes, allergies, monthlyGoal, workPattern, budgetMonthly},
    behavior: BehaviorSummary,
    recentEvents: 30 newest,
    memories: top 10,
    lastSleepMinutes, lastMood,
    todaySpendVnd, monthSpendVnd,
    openHighPriorityTaskCount,
  }
  ```
- **`InsightGenerator`** — replaces the 5-rule recommender for users with an
  AI key. Sends UserContext to LLM with strict rules:
  - Never suggest food the user listed in `allergies` or `dislikes`.
  - If `behavior.moodSleepCorrelation < -0.4`, include a sleep nudge.
  - If `todaySpendVnd / monthSpendVnd > 0.7 × budgetMonthly`, include a
    finance nudge.
  - Don't repeat insights already `INSIGHT_DISMISSED` in recentEvents.
  - 1-3 nudges max, quality > quantity.
- **`MemoryController`** — `GET /api/memory` (list), `DELETE /api/memory/:id`
  (forget), `POST /api/memory/:id/confirm` (bump weight).

### Wired into existing services

- **ConfirmService** writes `CAPTURE_CONFIRMED` to EventLog and recomputes
  BehaviorSummary on sleep/expense/income confirms.
- **TasksService** writes `TASK_COMPLETED` / `TASK_DELETED`.
- **PlannerService** writes `PLAN_ITEM_DONE` / `PLAN_ITEM_SKIP` /
  `PLAN_ITEM_EDITED`. New `PUT /daily-plan/items/:id` endpoint lets the user
  edit title + time (the edit itself is a signal: the AI got the time wrong).
- **RecommendationsService.refresh** tries InsightGenerator first; falls
  back to the rule generator. `INSIGHT_LIKED` / `INSIGHT_DISMISSED` events
  get logged on patch.
- **AssistantService** injects a context prelude (profile + behaviour +
  memories rendered as plain text) as a second system message before the
  user turn. Fire-and-forget memory extraction runs after each turn.
- **PlannerAiGenerator** sends UserContext (behaviour summary + memories +
  recent events) alongside the legacy snapshot.

### Mobile

- **PreferencesScreen** (`Settings → Hiểu bạn hơn`) — collects dislikes /
  allergies / monthlyGoal / workPattern / budget. All optional. The values
  PATCH `/profile` and immediately influence the next AI call.
- **MemoryScreen** (`Settings → Trí nhớ AI`) — list of remembered facts
  with `forget` action. Honours the privacy promise: nothing the AI keeps
  is hidden from the user.
- **SmartNudges component** — banners on Home that don't need an AI call:
  "No breakfast yet today" (after wake+2h with 0 meals logged), "Spending
  higher than usual" (today > 1.7× this month's daily average).
- **NudgeCard** insight feedback — 👍 Useful (`status: APPLIED`) /
  ✕ Dismiss (`status: DISMISSED`) buttons. Both write to EventLog so future
  AI calls know what landed.

### i18n

Added `preferences.*`, `memory.*`, `nudges.*`, `settings.preferencesEntry`,
`settings.memoryEntry` blocks for vi + en.

---

## Effort + footprint

```
Files changed                         29
+1,847 / -42 lines
New tables                             3 (UserBehaviorSummary, EventLog, AssistantMemory)
New UserProfile columns                5
New API endpoints                      4 (memory list/forget/confirm + plan item edit)
New mobile screens                     2 (Preferences, Memory)
New mobile component                   1 (SmartNudges)
New backend module                     1 (intelligence — 6 files)
APK size                              59 MB → 59 MB (no native deps added)
```

## Verified

- TS clean (mobile + api).
- jest 54/54 pass.
- APK built + launched on Xiaomi 13T 100.118.234.3:5555.
- Migration `20260429042513_round18_intelligence` applied to dev Postgres.

---

## What's next (round 19+)

- Mid-day plan **regeneration** when sleep < 4h is logged (currently only
  recomputes BehaviorSummary; we could re-call PlannerAiGenerator).
- 22:00 push notification "Check-in giấc ngủ?" via FCM (round 19 native
  module work).
- Memory weight decay over time + UI to mark a fact as "no longer true".
- Insight feedback influences weight on AssistantMemory facts that drove
  the insight.
