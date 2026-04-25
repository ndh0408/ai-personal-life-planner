# Privacy Center — LifeOS AI

**Audience:** users (in-app), product owners, security reviewers, store reviewers (Apple / Google).
**Source of truth in code:** `apps/api/src/modules/privacy/*`, `apps/mobile/src/screens/privacy/*`, schema `prisma/schema.prisma` Section K.
**Policy version surfaced to users today:** `2026-04-25` (kept in `apps/mobile/src/services/api/privacy.api.ts` as `PRIVACY_POLICY_VERSION`).

---

## 1. Why this exists

LifeOS AI handles extremely sensitive personal data: health, mood, salary, expenses, debts, calendar, AI keys, voice notes. Apple and Google reject apps that touch this data without:

- a clearly-explained purpose for every permission,
- a per-domain user toggle to revoke at any time,
- a real audit trail of consent grants and revocations,
- and a guarantee that opting out actually stops the data flow.

The Privacy Center delivers all four. Every privacy toggle is enforced at the **server** — the mobile app cannot bypass it because the AI services check the toggle BEFORE building the prompt.

---

## 2. Architecture

```
┌─────────────────────┐  HTTPS  ┌────────────────────────────────────┐
│ Mobile (Expo)       │ ──────► │ NestJS API                         │
│ ──                  │         │ ──                                 │
│ PrivacySettings     │         │ /api/privacy/settings  (GET/PUT)   │
│ PermissionCenter    │         │ /api/privacy/consent   (POST)      │
│ DataUsageSummary    │         │ /api/privacy/consents  (GET)       │
│                     │         │ /api/privacy/data-usage-summary    │
│ • Toggles           │         │                                    │
│ • OS-permission     │         │ PrivacyService.aiGates(userId)     │
│   live status       │         │   ↑ called by every AI service     │
│ • Consent log UI    │         │                                    │
└─────────────────────┘         │ Postgres                           │
                                 │ • privacy_settings (1:1 user)      │
                                 │ • user_consents (event log, append)│
                                 └────────────────────────────────────┘
                                                │
                                                ▼
                              ┌──────────────────────────────────┐
                              │ AI services check gates BEFORE   │
                              │ collecting user data:            │
                              │ • ai-finance.service             │
                              │ • ai-planner.service             │
                              │ • ai-meal.service                │
                              │ • ai-daily-review.service        │
                              │ • ai-insight.service             │
                              │ • ai-chat.service                │
                              └──────────────────────────────────┘
```

---

## 3. Data model

### `privacy_settings` (1 row per user, lazy-created)

| Column | Default | What it gates |
|--------|---------|----------------|
| `personalizationEnabled` | true | Master switch. When false, every other AI gate is implicitly false. |
| `useScheduleForAI` | true | Sends today's plan, tasks, habit progress to AI. |
| `useFinanceForAI` | true | Sends income/expense/budget aggregates to AI. |
| `useHealthForAI` | true | Sends sleep/mood/health metrics to AI. |
| `useMealForAI` | true | Sends meal logs + dietary preferences to AI. |
| `useCalendarContext` | **false** | Lets the app request OS calendar permission. |
| `useLocationContext` | **false** | Lets the app request OS foreground location permission. |
| `useHealthFitnessContext` | **false** | Lets the app request OS health/fitness permission. |
| `voiceInputEnabled` | **false** | Lets the app request OS microphone permission. |
| `proactiveRecommendations` | true | Allows the rule-based assistant to nudge. No AI calls when off. |
| `anonymizedDiagnostics` | **false** | Opt-in to crash + perf metrics (never PII). |

Defaults are deliberately conservative: AI personalisation domains the user opted into at signup default ON; **device-permission gates default OFF** so we never even *think* about prompting the OS without a deliberate user opt-in.

The row is materialised on the first `PUT` — until then `getSettings()` returns the in-memory defaults so reads are free.

### `user_consents` (append-only event log)

| Column | Notes |
|--------|-------|
| `consentType` | `TOS \| PRIVACY_POLICY \| AI_PROCESSING \| PERSONALIZATION \| DIAGNOSTICS \| NOTIFICATIONS \| CALENDAR \| LOCATION \| HEALTH_FITNESS \| MICROPHONE \| CAMERA \| PHOTOS` |
| `granted` | true for grant, false for revoke |
| `version` | Free-form policy version string, e.g. `2026-04-25` |
| `grantedAt` | Server timestamp |
| `revokedAt` | Filled when a *later* revoke event references this grant |
| `metadata` | JSON with `{ source: 'onboarding' \| 'settings' \| 'pre-feature', platform, locale }` |

Revocation never mutates the original grant — it writes a NEW row with `granted=false` and back-fills the prior grant's `revokedAt`. Result: an unbroken audit trail of every consent change, queryable per user.

Indexed by `(userId, consentType)` and `(userId, grantedAt)`.

---

## 4. AI data minimisation — exactly what the resolver checks

`PrivacyService.aiGates(userId)` returns a struct that compounds `personalizationEnabled` with each domain toggle. AI services call it BEFORE collecting / sending data:

| AI service | Gate(s) consulted | Behaviour when gate is OFF |
|------------|-------------------|----------------------------|
| `ai-chat.service` | `personalization` | Skips the userProfile fetch; chat still works but prompts contain no profile fields. Timezone is kept (it's non-PII and required for time-aware advice). |
| `ai-finance.service` | `finance` | Returns the locale-appropriate fallback template. **No AI call**, no upstream cost. |
| `ai-planner.service` | `schedule` | Persists `FALLBACK_PLAN` directly. No AI call. |
| `ai-meal.service` | `meal`, `health` (for dietary profile) | Returns `FALLBACK` meals when meal gate off; strips dietary profile from prompt when health gate off. |
| `ai-daily-review.service` | `personalization`, `finance`, `health`, `meal` | When personalisation off → generic fallback, no AI call. Otherwise zero out the per-domain context fields the user opted out of. |
| `ai-insight.service` | `schedule`, `health` | Skips entire `findMany` queries when the matching gate is off; downstream stats are zeroed. |

Every short-circuited response carries `usedFallback: true` AND a new `disabledByPrivacy: true` flag so the mobile UI can surface "Personalisation is off — turn it on in Privacy" instead of pretending the AI failed.

---

## 5. Mobile UX contract

**PrivacySettingsScreen.** Groups 14 toggles into 4 sections (Personalisation / What AI may see / Device context / Behaviour). Each toggle:

- Shows the human-readable label + a 1–2 sentence hint that names the data sent and the purpose.
- Writes to `PUT /api/privacy/settings` immediately — no separate "Save" button to forget.
- Turning OFF the master `personalizationEnabled`, `useFinanceForAI`, or `useHealthForAI` shows an explicit confirm dialog (load-bearing toggles).
- Posts a matching `UserConsent` event with `version=2026-04-25, source='settings'` for every grant/revoke.
- Stays bilingual (vi/en) — every label, hint, and section heading goes through `t(...)`.
- Bottom of the screen exposes Permission Center, Data usage, **Export data**, **Clear AI memory**, and **Delete account** entry-points.

**PermissionCenterScreen.** Lists every OS permission with its purpose. Today only `Notifications` shows live status (Expo Notifications is the only wired permissions module). The rest are documented with explicit "no background recording / no tracking / no reading other apps" statement. Provides a deep-link to OS settings (`app-settings:` on iOS, `Linking.openSettings()` on Android) so the user can revoke any granted permission outside the app.

**DataUsageSummaryScreen.** Reads `GET /api/privacy/data-usage-summary` and shows:
- 7 boolean badges: what AI can currently see (`aiSeesSchedule`, `aiSeesTasks`, `aiSeesHabits`, `aiSeesMeals`, `aiSeesHealth`, `aiSeesFinance`, `aiSeesGoals`).
- `lastAccess` timestamp per data type (sourced from `SensitiveAccessLog.groupBy`) so the user can see "Finance was last used by AI 2h ago".
- Per-table row counts the user owns (schedules, tasks, expenses, …) so the user can see "I have 247 expenses on the server".
- Last 20 consent events.

**PersonalizationConsentScreen** (v1.2). Onboarding-style screen with 12 grouped toggles + three CTAs (Enable recommended / Customize / Skip for now). Reachable from `Settings → Privacy → Personalize` today; v1.3 will gate behind a `personalizationConsentGivenAt` flag so first-run users see it before reaching Today. See `docs/PERSONALIZATION_CONSENT.md`.

**RecommendationEvidenceScreen** (v1.2). Modal-style "Why am I seeing this?" surface reachable from any Recommendation card. Renders one card per `RecommendationEvidence` row (data-type badge + locale-tagged summary + optional weight). See `docs/EXPLAINABLE_RECOMMENDATIONS.md`.

**ClearAIMemoryScreen** (v1.2). Standalone screen with explainer copy + destructive confirm. Calls `POST /api/privacy/clear-ai-memory` — soft-clears `AiPersonalizationMemory` rows (flips `isActive=false`); does NOT touch chat history, finance data, or evidence rows.

---

## 6. Hard "no" list (what this app does NOT do)

The product spec is explicit about behaviours that are off-limits. Each item below is enforced at the architecture / OS layer, not just by policy:

- **No background microphone.** `expo-av` (microphone) is not even installed today; if/when it is, mic activation is gated by `voiceInputEnabled` AND only activated while the user holds a record button.
- **No background location.** Mobile only ever requests `requestForegroundPermissionsAsync` when location ships. There is no `requestBackgroundPermissionsAsync` call anywhere.
- **No third-party tracking SDKs.** Repo `package.json` has no analytics / tracking deps (no Segment / Amplitude / Mixpanel / Adjust / AppsFlyer). Diagnostics, when added, will be the user-toggled `anonymizedDiagnostics`.
- **No accessibility hooks.** Neither `expo-accessibility` nor any `AccessibilityInfo` listeners read screen content.
- **No reading other apps.** No `expo-contacts` / `expo-clipboard` polling / `MediaLibrary` background scan.
- **No silent collection.** Every Prisma write that holds user data is triggered by an explicit user action; the server never opportunistically harvests anything.
- **No PII in logs.** `apps/api`'s logger logs request method/URL/status only. AI provider service logs `provider/model/task/usedFallback/userScope` only. Never the body, prompt, response, or key.
- **No sandbox bypass.** The mobile app uses standard Expo native modules; no JSI bridge to native APIs that aren't documented Expo APIs.

---

## 7. Required environment / build configuration

Today the Privacy Center has zero env-var dependencies — the toggles are stored in Postgres and the AI gates are pure code. Adding new permission integrations later means:

- Adding the matching Expo module (`expo-calendar`, `expo-location`, `expo-camera`, `expo-image-picker`, `expo-av`, `expo-health-connect`).
- Adding the matching iOS Info.plist usage strings (`NSCalendarsUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`, `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`).
- Adding the matching Android `<uses-permission>` lines.
- Wiring the live status into `PermissionCenterScreen` (replace each item's `realCheck: false` with the matching `getPermissionsAsync()`).
- Gating the runtime usage on the matching `PrivacySetting.use*Context` toggle.

---

## 8. Production checklist

- [ ] Privacy policy / ToS document hosted at a stable URL.
- [ ] `PRIVACY_POLICY_VERSION` bumped on each policy change so `UserConsent.version` mismatches surface.
- [ ] Account deletion endpoint (`DELETE /api/users/me`) wired — `User onDelete: Cascade` already covers `privacy_settings`, `user_consents`, BYOK rows, finance, health, AI messages.
- [ ] Backup includes `privacy_settings` + `user_consents` (it does — `pg_dump` covers all tables).
- [ ] Backup is encrypted at rest.
- [ ] Mobile screen text reviewed by legal in both vi and en.
- [ ] App store submission lists every permission with the in-app explanation.
- [ ] Verified that disabling each `useXForAI` toggle yields a `disabledByPrivacy: true` response from the corresponding `/api/ai/*` endpoint.

---

## 9. Shipped in v1.2

- 7 new domain-specific AI gates (`useTasksForAI`, `useHabitsForAI`, `useMealsForAI`, `useGoalsForAI`, …) with confirms on load-bearing toggles.
- 3 new Prisma models: `SensitiveAccessLog` (metadata-only audit), `RecommendationEvidence` (locale-tagged summaries powering "Why am I seeing this?"), `AiPersonalizationMemory` (soft-clearable AI memory ledger).
- 3 new endpoints: `POST /api/privacy/export-data`, `POST /api/privacy/clear-ai-memory`, `POST /api/privacy/delete-account-request` (records intent + 30-day grace).
- 3 new mobile screens: `PersonalizationConsentScreen`, `ClearAIMemoryScreen`, `RecommendationEvidenceScreen`.
- AI services emit `SensitiveAccessLog` rows on every access of finance / health / tasks / habits / meals / goals.

## 10. Roadmap

- v1.3: First-run gating of `PersonalizationConsentScreen` via `personalizationConsentGivenAt`.
- v1.3: Wire `expo-calendar` / `expo-location` / `expo-camera` / `expo-av` and surface live OS status in `PermissionCenterScreen`.
- v1.3: Account-deletion cascade worker (today the request endpoint records intent only).
- v1.3: Async export job + signed-URL download for very large users.
- v1.3: Per-row currency on Income/Expense (already noted in `ENTERPRISE_SCALE_SECURITY_AUDIT.md` §7).
- v1.3: Field-level encryption for `monthlySalary`, `MoodLog.note`, `healthNotes` via `pgcrypto`.
- v1.4: Differential-privacy aggregation for opt-in diagnostics.
