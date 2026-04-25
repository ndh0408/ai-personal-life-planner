# AI Data Minimisation — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/privacy/privacy.service.ts` (`aiGates` + `logAccess`) and the 6 AI services that consume them.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md) and [PERSONALIZATION_CONSENT.md](./PERSONALIZATION_CONSENT.md).

## 1. Principle

Every AI request asks two questions BEFORE building a prompt:

1. **May we use this user's data?** — `PrivacyService.aiGates(userId)` returns a struct compounding `personalizationEnabled` with each domain toggle (`schedule`, `tasks`, `habits`, `meals`, `health`, `finance`, `goals`, plus device gates).
2. **What's the smallest summary the AI actually needs?** — services pull aggregates, not raw rows.

The two together = no data leaves the boundary that the user did not consent to AND no raw row leaves the boundary when an aggregate would do.

## 2. Decision flow per request

```
HTTP request → Controller → Service.method(userId, input)
                                       │
                                       ▼
                              gates = PrivacyService.aiGates(userId)
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   personalization OFF       Domain gate OFF            All gates OK
   → return generic         → skip findMany /          → fetch + summarise
     fallback                  zero out context           + logAccess() per
   + disabledByPrivacy:true    field; no AI call           accessed domain
                               for that domain            + send aggregates
                                                            (NEVER raw notes)
```

`logAccess(userId, dataType, purpose, accessedBy, sourceFeature)` writes a metadata-only `SensitiveAccessLog` row. Failures are swallowed — an audit-write outage cannot block AI.

## 3. Per-AI-service contract

| AI service | Master gate | Domain gates checked | Action when OFF |
|-----------|-------------|----------------------|-----------------|
| `ai-chat.service` | `personalization` | n/a (chat is interactive) | userSnapshot is empty (timezone kept). |
| `ai-finance.service` | `personalization` | `finance` | Returns locale fallback. **No AI call.** `disabledByPrivacy: true`. |
| `ai-planner.service` | `personalization` | `schedule` | Persists FALLBACK_PLAN directly. **No AI call.** |
| `ai-meal.service` | `personalization` | `meals` (primary) + `health` (for dietary profile) | Returns FALLBACK meals; strips dietary profile from prompt when health is off. |
| `ai-daily-review.service` | `personalization` | `tasks`, `habits`, `meals`, `health`, `finance`, `goals` | Generic fallback when master off; otherwise zero out the per-domain context fields the user opted out of. **logAccess** for each INCLUDED domain. |
| `ai-insight.service` | `personalization` | `tasks`, `habits`, `health` | Skips the matching `findMany` entirely; downstream stats become zero. **logAccess** for each. |

Recommendation generation in `assistant/services/recommendation.service.ts` is rule-based (no AI call), but each persisted recommendation now stores `RecommendationEvidence` rows so the user can see "why am I seeing this?" — see EXPLAINABLE_RECOMMENDATIONS.md.

## 4. What we send vs what we keep

| Domain | Sent to AI | NOT sent |
|--------|------------|----------|
| Finance | `totalIncome`, `totalExpense`, `byCategory[]`, `budgetWarnings[]`, `walletsTotal`, `currency` (single value) | raw expense `note` strings, raw `Debt.personName`, raw transaction descriptions, payment method per row, full debt timeline |
| Health | `sleep.durationMinutes`, `sleep.quality`, `mood.mood`, `mood.energyLevel`, `mood.stressLevel`, dominant mood for the period | raw `MoodLog.note`, raw `HealthMetric.note`, `UserProfile.healthNotes`, per-second heart-rate / GPS samples |
| Tasks | counts by status (`completed`, `inProgress`, `todo`, `cancelled`) | raw task `description`, attachments |
| Habits | per-habit `name`, `targetPerWeek`, `logged` count | raw streak metadata, log notes |
| Schedule | `present` flag + per-status counts (`completed`, `total`, `pending`, `skipped`, `delayed`) for daily review | full item descriptions, calendar invitee lists |
| Meals | `planCount`, `logCount`, `estimatedCaloriesSum`, `cost` | per-meal `recipe`, `note`, `tags` |
| Goals | `[{ title, progressPercent }]` | raw `description`, milestone notes |

## 5. What `personalizationEnabled = false` actually does

When the master switch is off, **every** domain gate evaluates to false (the `aiGates` struct ANDs them). Concretely:

- ai-chat keeps working but the userSnapshot block in the prompt is empty — the model has no profile context, only the message.
- ai-finance / ai-planner / ai-meal / ai-daily-review return their deterministic locale fallback responses with `usedFallback: true` AND `disabledByPrivacy: true`.
- ai-insight emits an "no data this week" insight built from zero counts.
- The assistant's recommendation engine (rule-based) still runs, but its evidence is shorter and the recommendations turn into "general lifestyle reminder" templates.

The user remains a fully-functional app user — they just stop receiving **personalised** advice.

## 6. Hard rules the code enforces

- **No API key, token, or password** is ever inserted into a prompt. There is no path that accepts those — they are stored encrypted (BYOK) or in env (global) and only the resolver decrypts them at fetch time.
- **No raw transaction list** is sent — finance always summarises before prompting.
- **No `MoodLog.note` / `HealthMetric.note` / `healthNotes`** is sent — the prompt builders read only the structured columns.
- **`SensitiveAccessLog` is metadata-only** — see `apps/api/src/modules/privacy/privacy.service.spec.ts` for the regression test that asserts the row has exactly `{userId, dataType, purpose, accessedBy, sourceFeature, createdAt, id}` keys and nothing else.
- **`RecommendationEvidence.summary`** is a short locale-tagged human sentence — never an amount, never a raw note.

## 7. Roadmap

- v1.3: `PersonalizationContextBuilder` extracted from the per-service `collect()` methods so the redaction logic lives in one place. Today each service inlines its own gate-checks; that's the simplest correct shape for v1.2.
- v1.3: `SensitiveDataRedactionService` formal API — currently each prompt builder hardcodes which structured fields to send.
- v1.4: AI usage cost ledger keyed off the `SensitiveAccessLog` rows, so we can warn a user "your finance domain was queried 47× this week" inside DataUsageSummary.
