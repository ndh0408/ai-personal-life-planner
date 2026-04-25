# AI Usage Ledger

Every AI call now writes a row to `ai_usage_logs`. Quotas are enforced per
user per day in the user's timezone.

## Models

```prisma
enum AiUsagePlan { FREE  PRO  ADMIN }

enum AiFeature {
  CHAT, GENERATE_SCHEDULE, RESCHEDULE, SUGGEST_MEALS,
  ANALYZE_FINANCE, DAILY_REVIEW, WEEKLY_INSIGHT,
  ASSISTANT_MONITOR, QUICK_CAPTURE, HEALTH_SCREEN
}

model AiUsageLog {
  id, userId, feature, provider, model,
  requestId?, inputTokens?, outputTokens?, totalTokens?,
  estimatedCostMicroUsd?,        // cents × 10000 to keep integer math
  success, errorCode?, latencyMs?,
  createdAt
}

model AiUsageQuota {
  id, userId @unique, plan,
  dailyChatLimit, dailyScheduleLimit, dailyFinanceAnalysisLimit,
  dailyMealSuggestionLimit, dailyAssistantMonitoringLimit, dailyReportLimit
}
```

## Privacy guarantees

The ledger schema has **no column** for prompt, response, or any user-context
payload. The fields are intentionally only the audit-required metadata:

- who → `userId`
- what → `feature`, `provider`, `model`
- how big → token counts + estimated cost
- how it went → `success` / `errorCode` / `latencyMs`

`AiUsageService.log()` mirrors this — there is no place to slip a prompt in.
The unit test `ai-usage.service.spec.ts` asserts that the persisted row never
contains `prompt`, `text`, or `content` fields.

## Wiring point

`AiProviderService.complete()` accepts an optional `usageCtx: { userId, feature }`.
Every AI feature service (chat, planner, finance, meal, daily-review, etc.)
passes the context so we get a complete audit trail without duplicating
quota / log code.

```ts
await this.aiProvider.complete(req, opts, undefined, {
  userId: user.id,
  feature: 'CHAT',
});
```

The provider service:

1. Calls `AiUsageService.assertWithinQuota(userId, feature)` — throws 403
   `AI_DAILY_LIMIT_REACHED` if at the cap.
2. Times the actual provider call.
3. On success: writes a `success=true` row with token counts + latency.
4. On failure: writes a `success=false` row with `errorCode = AI_TIMEOUT |
   AI_PROVIDER_FAILED`.

## Quota check (timezone-aware)

`assertWithinQuota` uses the user's `profile.timezone` to compute "today",
so a user in Asia/Ho_Chi_Minh resets at midnight ICT, not server-local
midnight.

Admin plan (`plan: 'ADMIN'`) bypasses the check entirely.

## Endpoints

```
GET  /api/ai/usage/today
     → { day: { from, to, timezone }, plan, perFeature[], limits }

GET  /api/ai/usage/history?from=ISO&to=ISO
     → [{ id, feature, provider, model, success, errorCode,
          totalTokens, latencyMs, createdAt }, ...]   (max 200 rows)
```

Both require JWT; both filter by `req.user.id` — no cross-user reads.

## Failure modes

| Scenario | Behaviour |
|--|--|
| Quota exceeded | 403 `AI_DAILY_LIMIT_REACHED` before provider call |
| Provider 5xx | log `success=false errorCode=AI_PROVIDER_FAILED`; retry per orchestrator policy; throw on final failure |
| Provider timeout | log `success=false errorCode=AI_TIMEOUT` |
| Ledger write itself fails | warn-log only; never blocks the user-facing AI call |

## Default plan limits

```
FREE:
  chat=40, schedule=10, financeAnalysis=10, mealSuggestion=10,
  assistantMonitoring=20, report=20

PRO:   (set per-user via DB; not exposed in self-serve UI yet)
ADMIN: bypass
```
