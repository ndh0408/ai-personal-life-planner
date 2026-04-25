# Explainable Recommendations — LifeOS AI

**Audience:** product, design, AI engineering, store reviewers.
**Source of truth in code:** `apps/api/src/modules/privacy/privacy.service.ts` (`addRecommendationEvidence`, `listRecommendationEvidence`), `apps/mobile/src/screens/privacy/RecommendationEvidenceScreen.tsx`, schema `prisma/schema.prisma` `RecommendationEvidence`.

## 1. Why

Every AI-style recommendation must answer the user's reasonable question:

> "Why am I seeing this?"

When the user can see WHICH data led to a nudge, they:
- trust the system more,
- spot stale or wrong data faster,
- can revoke the matching toggle and get a different recommendation tomorrow,
- never feel surveilled.

This is also a prerequisite for compliant AI in EU markets and is increasingly expected by Apple App Store reviewers.

## 2. Data model

```
AIRecommendation 1 ──────n RecommendationEvidence
                          { dataType, summary, locale, weight }
```

`RecommendationEvidence` columns:

| Column | Notes |
|--------|-------|
| `id` | uuid |
| `recommendationId` | FK, cascade-delete with the parent recommendation |
| `userId` | FK, cascade-delete with user |
| `dataType` | enum `SCHEDULE \| TASKS \| HABITS \| MEALS \| HEALTH \| FINANCE \| GOALS \| CALENDAR \| LOCATION \| HEALTH_FITNESS` |
| `summary` | locale-tagged plain text — **never raw amounts / notes** |
| `locale` | `vi` / `en` |
| `weight` | optional 0..1 contribution score |
| `createdAt` | timestamp |

Indexed by `(recommendationId)` and `(userId, createdAt)`.

## 3. Producer contract

Recommendation producers (`recommendation.service.ts`, AI services) call:

```ts
await privacy.addRecommendationEvidence(rec.id, userId, [
  { dataType: 'HEALTH',  summary: 'Bạn ngủ 5h30 hôm qua.', locale: 'vi', weight: 0.8 },
  { dataType: 'TASKS',   summary: 'Còn 4 task pending.',    locale: 'vi', weight: 0.6 },
  { dataType: 'HEALTH',  summary: 'Bạn báo energy thấp hôm nay.', locale: 'vi', weight: 0.4 },
]);
```

Producer rules — enforced by code review + the `RecommendationEvidence` spec:

- **Summary is human-friendly first-person sentence** — what the user would say back to a friend ("I slept 5h30 last night"). Not "userId X consumed 5.5 hours of NREM phase 3 sleep".
- **Never include raw amounts.** Replace with semantic ranges: "82% of your food budget" not "1,640,000 VND of 2,000,000 VND".
- **Never include raw notes / titles** — those may contain PII the user doesn't want surfaced inside an evidence card.
- **Locale-tag** the summary so the mobile renders the right one. Producer fetches the user's locale via `LocaleService.forUser` once and tags every row.
- **At most ~5 evidence rows per recommendation** — too many becomes noise and re-introduces overwhelming detail.
- **Weights are optional**; when present they sort the UI list. They are NOT shown as percentages on small cards (currently the modal shows them as `Math.round(weight * 100)`% in the header badge).

## 4. Consumer contract

Mobile entry-point: `RecommendationEvidenceScreen` reachable from any Recommendation card's "Why am I seeing this?" button via `navigation.navigate('RecommendationEvidence', { recommendationId })`.

The screen calls `GET /api/privacy/recommendations/:id/evidence` and renders one card per evidence row with:

- A `Badge` for the data type (translated via `settings.privacy.evidence.dataType.<TYPE>`)
- The optional weight as a percent in the header right
- The `summary` text as the body

Empty state ships for legacy recommendations created before v1.2 (no evidence rows).

## 5. Consent revocation behaviour

Today: revoking a privacy toggle **does not** delete previously-recorded evidence rows. Past evidence stays viewable so the user can reason about why they got that nudge yesterday — it's effectively read-only history.

Future evidence will not be created for the revoked domain because the producer's gate-check (see AI_DATA_MINIMIZATION.md) blocks the matching collect step.

When the user clicks **Clear AI memory** (see PRIVACY_CENTER.md §5), `AiPersonalizationMemory` rows are soft-cleared but `RecommendationEvidence` is **not** touched — it's an audit trail of past decisions, not personalization memory.

## 6. Anti-pattern checklist

We deliberately do NOT:

- Show evidence weights as a "confidence score" — the model isn't actually that confident, and percentages imply false precision.
- Embed raw monetary amounts, raw notes, or raw transaction descriptions in `summary`.
- Generate evidence rows that contradict the producer's own logic ("you should sleep more" + evidence "you slept 9 hours yesterday").
- Show evidence to anyone other than the row's owning user — the controller scopes by `userId` from the JWT.

## 7. Roadmap

- v1.3: Group evidence by `dataType` in the modal (collapsible sections) when there are >3 rows.
- v1.3: Hide evidence rows whose `dataType` the user has since revoked, behind a "Show old data" disclosure.
- v1.4: Surface evidence inline on every Recommendation card (not just behind a button) for higher-trust contexts.
