# Context Inference Engine — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/context-inference/*`, `apps/mobile/src/components/context/SmartNudgeCard.tsx`, `apps/mobile/src/screens/context/ContextInferencesScreen.tsx`, schema Section O.
**Companion to:** [SMART_NUDGES.md](./SMART_NUDGES.md), [USER_PATTERNS.md](./USER_PATTERNS.md), [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [AI_DATA_MINIMIZATION.md](./AI_DATA_MINIMIZATION.md).

## 1. Why this exists

LifeOS AI promises to be a thoughtful companion, not a surveillance tool. The Context Inference Engine looks at the data the user has already given the app — schedules, sleep logs, mood logs, expenses, habits, goals — and decides whether one of 8 known life-context patterns applies right now. When it does, the app surfaces a single human-tone nudge with the EVIDENCE that triggered it.

Hard rules:
- **Rule-based first.** v1.2 ships with zero AI calls in the engine. The 8 inference rules are deterministic, bounded, and easy to audit.
- **Privacy-gated.** Each rule reads only the domains the user has consented to via `PrivacySetting`. Health, finance, schedule, tasks, habits, meals, goals all have independent gates.
- **Confidence + evidence required.** Every persisted `ContextInference` row carries `confidence: number` AND a locale-tagged human evidence list. No verdict without proof.
- **No spam.** Same-type-same-day inferences DEDUPE: a DISMISSED or APPLIED row blocks any new row of the same type today; a still-open NEW/VIEWED row is updated in-place rather than re-created.
- **No data leak in evidence.** Evidence summaries reference structured fields (`5h20`, `82%`, `2 hours late`) — never raw notes / amounts / titles.

## 2. The 8 inference types

| Type | Trigger summary | Privacy gates required |
|------|-----------------|-------------------------|
| `POSSIBLE_SLEEPINESS` | Near usual sleep time + low sleep last night + low energy + many late tasks | health |
| `WORKLOAD_OVERLOAD` | ≥3 tasks pending after 21:00 | tasks |
| `MEAL_MAY_BE_SKIPPED` | 90+ min past usual meal time without a log | meals |
| `BUDGET_RISK` | Budget usage ≥ threshold AND ≥5 days left in month | finance |
| `TASK_PROCRASTINATION_RISK` | ≥2 overdue tasks | tasks |
| `HABIT_DROP_RISK` | ≥2 daily habits unchecked + after 19:00 | habits |
| `LOW_ENERGY_DAY` | Energy=LOW today (+ low sleep boosts confidence) | health |
| `NEED_REVIEW_DAY` | After 21:00 + no daily review row today | schedule |

Each rule outputs:
- `type`
- `confidence` (0..1; rules cap at sums of weighted booleans)
- `evidence: { locale, items: [{ key, summary }] }` — locale-tagged
- optional `suggestedAction: { type, ...payload }` for the mobile UI to wire as a Quick Action

## 3. Backend module shape

```
ContextInferenceModule
├── ContextSignalService.collect()        ─ scoped signals snapshot
├── InferenceRuleService.evaluate()       ─ pure rule engine
├── UserPatternService.refresh()/list()   ─ baselines (sleep time, meal time, avg expense)
├── RecommendationTriggerService.run()    ─ orchestrator + dedupe + persist
└── ContextInferenceController            ─ 5 endpoints
```

Endpoints (all JwtAuthGuard'd, throttled 30/min, run = 12/min):
- `GET  /api/context/today` — today's inferences + patterns + privacy gate snapshot
- `GET  /api/context/inferences` — all (50 most recent)
- `PATCH /api/context/inferences/:id/status` — NEW / VIEWED / DISMISSED / APPLIED
- `POST /api/context/run` — trigger one rule run
- `GET  /api/context/patterns` — list baselines

## 4. Privacy gating

The engine reuses `PrivacyService.aiGates(userId)` so it shares the same compounded master+domain logic the AI services use. Concrete behaviour:

- `useHealthForAI=false` → `gates.health=false` → POSSIBLE_SLEEPINESS / LOW_ENERGY_DAY / sleep evidence is skipped.
- `useFinanceForAI=false` → no BUDGET_RISK; budget signals not collected.
- `useTasksForAI=false` → no TASK_PROCRASTINATION_RISK / WORKLOAD_OVERLOAD; task counts not collected.
- `useHabitsForAI=false` → no HABIT_DROP_RISK; habit log queries skipped.
- `useMealsForAI=false` → no MEAL_MAY_BE_SKIPPED; meal log queries skipped.
- `useScheduleForAI=false` → no NEED_REVIEW_DAY; daily review check skipped.
- `personalizationEnabled=false` → ALL gates are false (master AND).

## 5. Tests

`apps/api/src/modules/context-inference/inference-rule.service.spec.ts` covers:

- POSSIBLE_SLEEPINESS fires when near-sleep + short-sleep + low-energy + late tasks.
- POSSIBLE_SLEEPINESS does NOT fire when health gate is OFF.
- MEAL_MAY_BE_SKIPPED fires past usual lunch when not logged.
- MEAL_MAY_BE_SKIPPED does NOT fire when meal already logged.
- BUDGET_RISK fires when usage > threshold AND ≥5 days left.
- BUDGET_RISK does NOT fire when finance gate OFF.
- NEED_REVIEW_DAY fires after 21:00 with no review.
- Evidence is locale-tagged.

Plus the deduper is exercised inside `RecommendationTriggerService` — same-day DISMISSED row blocks new creation; same-day NEW row gets updated in place.

## 6. AI escalation (v1.3 roadmap)

Today the engine is 100% rule-based. v1.3 will add an OPTIONAL escalation: when a rule emits an inference with confidence in the borderline band (0.5–0.65) the orchestrator may ask AI to "soften" the suggestion copy in the user's locale. The decision flow:

1. Rule fires → confidence band check.
2. If borderline + user has personalization on + global/BYOK provider configured → swap evidence summary with AI-rephrased text (still gated by `briefAiError` fallback).
3. Otherwise use the rule's own deterministic copy.

This keeps cost bounded — AI is invoked only when a borderline nudge would benefit from softer phrasing, not for every signal collection cycle.

## 7. Manual test plan

1. Seed a user with `usualSleepTime=23:30`, last night's sleep `320 minutes`, today's mood `energy=LOW`, 3 tasks due tomorrow, current time 22:30 → POST `/api/context/run` → expect `POSSIBLE_SLEEPINESS` row with confidence ≥ 0.5 + RESCHEDULE_LIGHT suggested action.
2. Toggle `useHealthForAI=false` in PrivacySettings → POST `/run` again → POSSIBLE_SLEEPINESS row no longer appears (HABIT_DROP_RISK / WORKLOAD_OVERLOAD may still fire).
3. PATCH `/inferences/:id/status` `{ status: 'DISMISSED' }` → POST `/run` again → no new row of that type today.
4. Wait until tomorrow → POST `/run` → row may appear again (dedupe is per-day).
5. On mobile Today, the top of the screen shows up to 2 highest-confidence open nudges as `SmartNudgeCard`s. Tap "Got it" → status=VIEWED. Tap "Dismiss" → row disappears today.
