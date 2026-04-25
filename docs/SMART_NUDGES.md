# Smart Nudges — LifeOS AI

**Source of truth in code:** `apps/mobile/src/components/context/SmartNudgeCard.tsx`, `apps/mobile/src/screens/today/TodayScreen.tsx`, `apps/mobile/src/screens/context/ContextInferencesScreen.tsx`, `apps/api/src/modules/context-inference/recommendation-trigger.service.ts`.
**Companion to:** [CONTEXT_INFERENCE_ENGINE.md](./CONTEXT_INFERENCE_ENGINE.md).

## 1. The product principle

A smart nudge is a single short card that:
- States ONE observation about your day in plain language.
- Lists the EVIDENCE that triggered it.
- Offers ONE optional Quick Action.
- Lets you Dismiss / Got it without judgement.

Tone: friendly, never authoritative. Every nudge is phrased as a soft observation or question, never a verdict.

Examples (vi):
- "Tối nay nên giảm tải một chút" — evidence "Bạn ngủ ~5.3h hôm qua", "Còn 3 task chưa xong sau 21h", "Năng lượng thấp" — Quick Action "Dời 2 việc nhẹ sang ngày mai".
- "Bạn đã ăn chưa?" — evidence "Đã qua giờ bữa trưa 1.7 tiếng và bạn chưa log" — Quick Action "Ghi nhanh bữa ăn".
- "Theo dõi ngân sách" — evidence "Ngân sách 'Ăn uống' đã dùng 92%", "Còn 12 ngày trong tháng" — Quick Action "Xem ngân sách".

## 2. Where nudges appear

- **TodayScreen** — top of the screen, up to 2 highest-confidence open nudges (NEW + VIEWED). Dismissed/Applied don't appear.
- **ContextInferencesScreen** (Smart context) — full list, opened from VoiceCompanion entry or from a SmartNudgeCard's Apply fallback.
- **AssistantScreen** — (planned v1.3) a Smart Context section pulled from the same `/api/context/today` query.

## 3. Card actions

| Button | What it does |
|--------|--------------|
| Quick Action button (if `suggestedAction` present) | Navigates to the matching screen + marks status=APPLIED so it doesn't reappear today. Mapping: `RESCHEDULE_LIGHT` → ContextInferences (review), `OPEN_MEAL_QUICK_LOG` → MealQuickLog, `OPEN_BUDGET_REVIEW` → Budget, `OPEN_DAILY_REVIEW` → DailyReview. |
| "Got it" | status=VIEWED. The card disappears today on next refresh. |
| "Dismiss" | status=DISMISSED. The card disappears today AND blocks any new same-type nudge for the rest of today. |

## 4. Privacy posture

The mobile UI never displays a nudge from a domain the user has revoked — the backend simply doesn't generate one. There is no client-side "censor" path: privacy enforcement lives at the source (`InferenceRuleService.evaluate` skips rules whose gate is OFF; `ContextSignalService.collect` skips the matching DB queries entirely).

## 5. Evidence rendering rules

- Evidence items are stored locale-tagged (`vi`/`en`) inside `ContextInference.evidence`. Mobile uses `evidence.items[].summary` directly — no translation lookup at render time.
- Confidence is shown as `%` in the card header, but the card never claims certainty. Tone is "I noticed X" not "You are Y".
- Confidence < 0.5 nudges are filtered server-side (rule engine returns nothing < 0.5).

## 6. Anti-pattern checklist

We deliberately do NOT:

- Show more than 2 nudges on Today simultaneously (overwhelm = noise).
- Auto-apply Quick Actions (every action is one extra explicit tap).
- Use red / shame-toned colors. Cards use the same neutral surface as everything else.
- Bundle multiple nudges into one card. Each insight stands alone with its own evidence.
- Log nudge content to the server-side logger. Only `inferenceId + type + confidence` make it to logs.

## 7. Manual test plan

1. Open Today with no qualifying signals → no SmartNudgeCard renders.
2. Mark 3 tasks pending after 21:00 in DB → POST `/context/run` → refresh Today → WORKLOAD_OVERLOAD card appears.
3. Tap "Dismiss" → card disappears. POST `/context/run` again → no new WORKLOAD_OVERLOAD card today.
4. Toggle `useTasksForAI=false` in Privacy → POST `/context/run` → no task-derived nudges appear.
5. Switch app language vi↔en → re-fetch `/context/today` → evidence summaries render in the new locale (the backend re-evaluates with the new locale at run time).
