# User Patterns — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/context-inference/user-pattern.service.ts`, schema `UserPattern`.
**Companion to:** [CONTEXT_INFERENCE_ENGINE.md](./CONTEXT_INFERENCE_ENGINE.md).

## 1. What a "pattern" is

A `UserPattern` is the inference engine's BASELINE for a single behavioural property of the user — e.g. "this user usually sleeps at 23:30", "this user's average daily expense is 200,000 VND". Patterns are PRECOMPUTED so the rule engine can ask "is the current signal unusual relative to this baseline?" in a single Map lookup.

Each pattern row carries:
- `patternType` (one of 10 enum values)
- `value` (Json — shape varies per type)
- `confidence` (0..1)
- `lastObservedAt` (so you know how stale the baseline is)

## 2. Pattern catalogue

| `patternType` | `value` shape | Source in v1.2 | Used by |
|---------------|---------------|----------------|---------|
| `USUAL_SLEEP_TIME` | `{ hour, minute }` | `UserProfile.usualSleepTime` if set | POSSIBLE_SLEEPINESS |
| `USUAL_WAKE_TIME` | `{ hour, minute }` | `UserProfile.usualWakeTime` if set | (future morning checkin) |
| `USUAL_MEAL_TIME_BREAKFAST` | `{ hour, minute }` | static default `07:30` | MEAL_MAY_BE_SKIPPED |
| `USUAL_MEAL_TIME_LUNCH` | `{ hour, minute }` | static default `12:00` | MEAL_MAY_BE_SKIPPED |
| `USUAL_MEAL_TIME_DINNER` | `{ hour, minute }` | static default `19:00` | MEAL_MAY_BE_SKIPPED |
| `USUAL_HABIT_TIME` | `{ hour, minute }` | (v1.3) derived from habit logs | (future HABIT_DROP_RISK_TIME) |
| `USUAL_PRODUCTIVE_HOURS` | `{ start, end }` | (v1.3) derived from completed-task timestamps | (future TASK_PROCRASTINATION_RISK improvements) |
| `COMMON_OVERLOAD_DAYS` | `{ weekdays: number[] }` | (v1.3) derived from past WORKLOAD_OVERLOAD inferences | (future preemptive WORKLOAD_OVERLOAD) |
| `COMMON_SKIPPED_TASK_CATEGORY` | `{ category: string }` | (v1.3) derived from cancelled tasks | (future TASK_PROCRASTINATION_RISK) |
| `AVG_DAILY_EXPENSE` | `{ amount: number }` | derived from last-30-day expenses | (future EXPENSE_VELOCITY signal) |

v1.2 derives 4 of the 10 types automatically from existing data + UserProfile fields. The remaining 6 are reserved for v1.3's nightly batch derivation.

## 3. Refresh strategy

- **v1.2 (current):** `RecommendationTriggerService.run()` calls `UserPatternService.refresh(userId)` at the start of every run. The refresh is cheap (3 queries: profile + expense aggregate + the upserts). For most users this completes in <50ms.
- **v1.3 (planned):** Move to a nightly job that recomputes from rolling-window logs. The runtime path will then read patterns without re-deriving.

## 4. Confidence semantics

- `0.9` — the value came from an explicit user setting (e.g. `UserProfile.usualSleepTime` filled at onboarding).
- `0.4` — static default (e.g. lunch=12:00). Rules treat it as a weak baseline.
- `~0.0–1.0 ramped` — derived from sample count (e.g. AVG_DAILY_EXPENSE confidence = `min(1, count/30)`).

The rule engine does NOT fire when the baseline is too weak AND the signal is borderline — confidence multiplies in. This protects new users from getting confidently-wrong nudges.

## 5. Privacy + retention

- Patterns are user-owned, cascade-deleted with the user.
- Pattern values are aggregates only — never raw notes/amounts.
- The user can wipe patterns indirectly by toggling personalization OFF (rules then skip the corresponding domains; refresh is still safe to run because it reads only the user's own rows).
- A direct "wipe my patterns" endpoint is reserved for v1.3 alongside the existing `POST /api/privacy/clear-ai-memory`.

## 6. Manual test plan

1. New user (no profile fields) → POST `/api/context/run` → `GET /api/context/patterns` returns the 3 static meal-time defaults at confidence 0.4.
2. Set `UserProfile.usualSleepTime=23:15` → POST `/run` → `USUAL_SLEEP_TIME` row appears at confidence 0.9.
3. Add 30 days of expenses → POST `/run` → `AVG_DAILY_EXPENSE` row appears, confidence ramps to 1.0.
4. Run twice in a row → second run returns the same pattern rows with `lastObservedAt` updated.
