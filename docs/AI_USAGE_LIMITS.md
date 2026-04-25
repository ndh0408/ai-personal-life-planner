# AI Usage Limits

Operational reference for the per-user quotas enforced in Round 12.

## Tier matrix

| Feature | FREE / day | PRO / day | ADMIN |
|--|--|--|--|
| Chat | 40 | (configurable) | unlimited |
| Schedule generate / reschedule | 10 | (configurable) | unlimited |
| Finance analysis | 10 | (configurable) | unlimited |
| Meal suggestion | 10 | (configurable) | unlimited |
| Daily review / weekly insight (`report`) | 20 | (configurable) | unlimited |
| Assistant monitoring | 20 | (configurable) | unlimited |
| Quick-capture / health-screen | counts toward `chat` bucket | | |

PRO limits live on the `AiUsageQuota` row — set per-user when the user
upgrades. There is no UI to upgrade in v1.2; treat PRO as an admin-toggle.

## Reset window

Per-user, per-day, **in the user's timezone** (`UserProfile.timezone`).
Fallback to UTC when the profile is missing.

## Errors

| Code | When | Where surfaced |
|--|--|--|
| `AI_DAILY_LIMIT_REACHED` | quota check rejects | 403 from any AI route |
| `AI_PROVIDER_FAILED` | provider returned non-2xx | 503 (after retries) |
| `AI_TIMEOUT` | provider exceeded `timeoutMs` | 503 (after retries) |
| `AI_RATE_LIMITED` | per-IP/per-user throttle | 429 |

## Mobile branch

The mobile error mapper should treat `AI_DAILY_LIMIT_REACHED` as:

> "You've reached today's AI limit. Try again after midnight (your time)."

A future "upgrade to PRO" CTA hooks here. v1.2 ships only the message.

## Admin overrides

```sql
-- Bump a user to PRO with custom caps
UPDATE ai_usage_quotas
SET plan = 'PRO',
    "dailyChatLimit" = 200,
    "dailyFinanceAnalysisLimit" = 50
WHERE "userId" = '...';
```

```sql
-- Reset a user's today usage (rarely needed; quota is per-row count, not
-- a counter, so deletion is the only "reset")
DELETE FROM ai_usage_logs
WHERE "userId" = '...' AND "createdAt" >= '2026-04-25 00:00:00';
```
