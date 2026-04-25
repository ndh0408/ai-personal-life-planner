# Personalization Consent — LifeOS AI

**Audience:** product, design, legal, store reviewers.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md) and [PERMISSIONS.md](./PERMISSIONS.md).
**Source of truth in code:** `apps/mobile/src/screens/privacy/PersonalizationConsentScreen.tsx` and `apps/api/src/modules/privacy`.

## 1. Product principle

> **LifeOS AI chỉ hiểu bạn từ những dữ liệu bạn cho phép. Bạn luôn kiểm soát dữ liệu nào được dùng để cá nhân hoá lời khuyên.**

Tone for every privacy-touching surface:
- gần gũi như một người bạn — never formal-legal
- nhẹ nhàng, không phán xét, không ép
- giải thích rõ "vì sao đưa lời khuyên" (see EXPLAINABLE_RECOMMENDATIONS.md)
- ưu tiên quyền riêng tư + sức khoẻ + sự ổn định của user
- không thao túng, không gây nghiện, không dùng dữ liệu nhạy cảm sai mục đích

## 2. The Consent screen

`PersonalizationConsentScreen` ships in v1.2 as a Settings-reachable screen. v1.3 will gate it behind a `personalizationConsentGivenAt` UserProfile flag so first-run users see it before reaching the Today tab.

Three CTAs:

| CTA | What it does |
|-----|--------------|
| **Enable recommended** | One-tap: applies the recommended preset and POSTs a `UserConsent` row per opted-in category. Recommended set = the 7 AI-data + behaviour toggles ON, all 4 device-permission toggles OFF. |
| **Customize** | Reveals the toggle list grouped (Daily life / Body & mood / Money / Goals / Device features / Behaviour). User toggles individually, then **Save**. |
| **Skip for now** | No PUT, no consent rows. The app still works — just less personalised. |

Twelve consentable items, grouped:

| Group | Item | Default |
|-------|------|---------|
| Daily life | Schedule & tasks | ON |
| Daily life | Habits | ON |
| Body & mood | Meals | ON |
| Body & mood | Health & lifestyle | ON |
| Money | Finance (sensitive) | ON |
| Goals | Personal goals | ON |
| Device features | Phone calendar | OFF |
| Device features | Phone Health / Fitness | OFF |
| Device features | Foreground location | OFF |
| Device features | Voice input | OFF |
| Behaviour | Proactive recommendations | ON |
| Behaviour | Anonymous diagnostics | OFF |

Each item carries a one-line **purpose** copy in both vi + en (`settings.privacy.consent.items.<key>.purpose`). Strings are deliberately friendly — no legal jargon. The promise banner ("We do not listen in. We do not track your phone. We do not read other apps.") is unconditional and renders above every group.

## 3. Backend wiring

- Toggling a switch in this screen calls `PUT /api/privacy/settings` with the matching `PrivacySetting` field.
- The matching `UserConsent` row (`{ consentType, granted: true, version: PRIVACY_POLICY_VERSION, metadata: { source: 'onboarding' } }`) is appended to the consent ledger.
- On revocation a NEW row with `granted: false` is appended; the prior grant's `revokedAt` is back-filled — see PRIVACY_CENTER.md §3.

## 4. What changes in the AI when each item is OFF

See AI_DATA_MINIMIZATION.md §4 — every toggle compounds with `personalizationEnabled` and short-circuits the matching AI service or context-collector.

## 5. Anti-pattern checklist

We deliberately **do not**:

- pre-tick everything and bury revoke deep in Settings
- use dark patterns ("Are you sure? You'll get worse results")
- block the Skip button until a category is enabled
- gate the app behind a "Continue" that requires every box ticked
- write extra UserConsent rows that the user did not explicitly toggle
- log this screen's interactions to anything other than the consent ledger

## 6. Per-platform rollout note

Today the screen is reachable from `Settings → Privacy & permissions → Personalize`. v1.3 will:

- Show it once after register, before Onboarding profile/finance steps.
- Skip to the existing Onboarding flow if `personalizationConsentGivenAt` is set.
- Re-prompt only when `PRIVACY_POLICY_VERSION` bumps AND the user has at least one OFF toggle that the new version added.
