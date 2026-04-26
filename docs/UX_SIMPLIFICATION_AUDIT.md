# Mobile UX Simplification Audit — Round 20.5

**Date:** 2026-04-26  
**Scope:** `apps/mobile/*` — focus on consumer-grade simplification.  
**Companion doc:** `docs/MOBILE_REAL_WORKFLOW_AUDIT.md` (real-vs-fake-flow audit).

This audit catalogues friction in the mobile UX and prioritises the changes
needed before LifeOS AI can ship to non-technical users. The codebase is
already feature-rich and the design system is solid — the friction is
concentrated in **AI setup, onboarding length, and bare-text-input forms**.

---

## A. Top friction points

| # | Surface | Issue | File |
|---|---------|-------|------|
| 1 | AI provider setup | 10-field form (provider chip + name + baseUrl + apiKey + 6 task-specific models). No "just paste your OpenAI key" path. | `screens/settings/AiProviderForm.tsx` |
| 2 | AI provider settings | Two preference toggles ("Use own API key" + "Fallback to global provider") with confusing copy and unclear interaction. | `screens/settings/AiProviderSettingsScreen.tsx:126-140` |
| 3 | Onboarding | 5 screens, ~21 fields, no skip path. Forces height/weight, IANA timezone, work hours, salary, wallet toggles before user can use the app. | `screens/onboarding/*` |
| 4 | Dashboard | No visible CTA when user has not yet configured an AI provider. AI features fail with a code instead of leading to setup. | `screens/dashboard/DashboardScreen.tsx` |
| 5 | Quick Capture | Voice STT is stubbed (`transcribeStub` i18n key surfaces a "voice not available" notice to users). Backend parse endpoint works for text, but the UI feels incomplete. | `screens/voice/QuickCaptureScreen.tsx:14-19,55` |
| 6 | Add Task | `dueDate` is a bare text input — users must type ISO datetime (`2026-05-01 18:00`). No `Today` / `Tomorrow` / `Weekend` chips. | `screens/tasks/CreateTaskScreen.tsx:231-240` |
| 7 | Add Expense | Date is a bare text input (`YYYY-MM-DD`). Wallet defaults to `null`; no auto-pick of the user's first wallet. Amount has no currency symbol. | `screens/finance/AddExpenseScreen.tsx:44,96-101,175-181` |
| 8 | Onboarding finance | Wallet creation errors are silently swallowed (`.catch(() => null)`); user sees success even on failure. | `screens/onboarding/OnboardingFinanceScreen.tsx:60-72` |
| 9 | Onboarding schedule | Timezone is a free-text field with no autocomplete or auto-detect. | `screens/onboarding/OnboardingScheduleScreen.tsx:78-83` |
| 10 | Provider test errors | Backend returns rich `lastTestError` (240 chars) but UI only shows generic `errors.AI_PROVIDER_TEST_FAILED`. | `screens/settings/AiProviderSettingsScreen.tsx:46-54` |
| 11 | Email verify banner | No dismissal — re-renders on every dashboard load. | `screens/dashboard/DashboardScreen.tsx:81` |
| 12 | Tab icons | Pure emoji (🏠 🗓 💰 ✨ 👤) — informal/casual for a "life OS" tool. | `navigation/MainTabsNavigator.tsx:15-21` |
| 13 | Add Task | AI helpers ("Split", "Timing") show no indication that they need an AI provider; failure path is generic. | `screens/tasks/CreateTaskScreen.tsx:148-188` |
| 14 | Provider config | Edit form keeps all 6 model fields visible by default — no "Advanced" collapsing. | `screens/settings/AiProviderForm.tsx:251-275` |
| 15 | Onboarding goal | Free-text dietary preference + health notes — no chips, no autocomplete. | `screens/onboarding/OnboardingGoalScreen.tsx:69-82` |
| 16 | Settings → AI | "Add provider" button is the only entry to the form; no quick "Connect OpenAI" CTA. | `screens/settings/AiProviderSettingsScreen.tsx:214-217` |
| 17 | Provider list | Shows masked key but not "last tested 5 minutes ago" relative time. | `screens/settings/AiProviderSettingsScreen.tsx:153-212` |
| 18 | AddExpense | "Note" is always visible; could collapse under Advanced. | `screens/finance/AddExpenseScreen.tsx:182-188` |
| 19 | CreateTask | Free-text "category" — no chip suggestions from prior tasks. | `screens/tasks/CreateTaskScreen.tsx:255-266` |
| 20 | All forms | No haptic / success toast pattern; success = silent `nav.goBack()`. | many |

## B. Top screens that need redesign (P0/P1/P2)

| Severity | Screen | What's wrong |
|----------|--------|--------------|
| P0 | `AiProviderForm` | Force-fits power-user form on consumers. Needs key-only fast path. |
| P0 | `AiProviderSettingsScreen` | Confusing preference toggles; no "Connect OpenAI" hero CTA. |
| P0 | `OnboardingProfileScreen` → `OnboardingFinanceScreen` | 5 mandatory steps, ~21 fields. Should collapse to 3 steps with skip. |
| P0 | `DashboardScreen` | Missing AI-not-configured CTA + Quick-Capture entry button. |
| P1 | `QuickCaptureScreen` | Stubbed voice notice + no rule-based fallback when AI key missing. |
| P1 | `AddExpenseScreen` | No date picker / no smart wallet default / no currency symbol. |
| P1 | `CreateTaskScreen` | Bare datetime field; no chips. |
| P1 | `EditAiProviderScreen` | Same form as Add — needs Advanced collapse + masked-key context. |
| P2 | `MealsScreen` AI CTA | Does not gate on provider state. |
| P2 | `OnboardingScheduleScreen` | Timezone + 4 time fields with no pickers. |
| P2 | `OnboardingGoalScreen` | Mainly fine; only health/diet free-text fields. |
| P2 | `AddBudgetScreen` | Same bare-input issues as AddExpense. |
| P2 | `CreateHabitScreen` | Same bare-input issues. |
| P2 | `CreateGoalScreen` | Same bare-input issues. |
| P2 | `AssistantScreen` | Should surface "configure AI" inline when empty. |
| P2 | `EmailVerifyBanner` | Persistent; no dismissal. |
| P2 | `MainTabsNavigator` | Emoji-only tab icons. |
| P2 | `SettingsScreen` | "AI provider" buried — needs "Connect AI" CTA at top. |
| P2 | `HealthMetricScreen` | Bare numeric inputs without unit toggles. |
| P2 | `WidgetSettingsScreen` | Untested; may be placeholder. |

## C. Quick wins (< 1 hr each)

1. Default `AddExpense` wallet to first wallet from `walletsApi.list()`.  
2. Display currency symbol prefix on `AddExpense.amount`.  
3. Add `Today / Tomorrow / Weekend` chips above `dueDate` on `CreateTask`.  
4. Show `lastTestError` (or its first ~120 chars) when provider test fails.  
5. Map `OPENAI_KEY_INVALID` and `AI_DAILY_LIMIT_REACHED` codes to friendly i18n.  
6. Show `AI not enabled` banner on Dashboard when provider list is empty.  
7. Give `EmailVerifyBanner` a session-scope dismiss.  

## D. Production blockers

1. **AI provider setup is too technical** — the single biggest blocker.  
2. **Onboarding asks too much** — likely cause of high drop-off.  
3. **Quick Capture STT stub** — surfaced to users; either wire or hide.  
4. **No AI-not-configured CTA on Home** — users stuck after signup.  
5. **Timezone free-text** — backend may reject silently on Finish.

## E. Existing design-system inventory (no gaps)

`apps/mobile/src/theme/`:
`colors.ts`, `spacing` + `radius` + `typography` (in `index.ts`),
`shadows.ts`, `motion.ts`, `layout.ts`, `semantic.ts`.

`apps/mobile/src/components/ui/`:
`AppHeader`, `AppShell`, `Card`, `Button`, `Input`, `Chip`, `Badge`,
`IconButton`, `Loading`, `ErrorView`, `EmptyState`, `ConfirmDialog`,
`Screen`, `Skeleton`, `SectionHeader`, `MoneyCard`, `ProgressCard`,
`InsightCard`, `RecommendationCard`, `StatCard`, `PrivacyNoticeCard`,
`QuickActionButton`, `OfflineBanner`, `BarChart`, `StepProgress`.

→ Round 20.5 introduces no new tokens; only adds `ApiKeySetupCard` and
`SuggestedActionCard` and reuses everything else.

## F. Strategy decided for Round 20.5

- **Phase 1 — AI Setup Simplification** (this round):
  - Add `POST /user-ai-providers/openai-simple` accepting just `{ apiKey }`.
  - New `AISetupScreen` (modal): one input + Test + Save.
  - Redesign `AiProviderSettingsScreen` with a hero "Connect OpenAI" card
    when empty, and an Advanced fold for the existing power-user form.
  - Map `OPENAI_KEY_INVALID`, `AI_DAILY_LIMIT_REACHED`, `NETWORK_ERROR`,
    `CONCURRENT_WRITE` error codes to friendly i18n.
- **Phase 2 — Home + Quick Capture** (this round):
  - Surface "AI not enabled" CTA + Quick-Capture pill on Dashboard.
  - New `QuickCaptureScreen` with **rule-based parser fallback** so users
    can capture expense/task even before configuring AI.
- **Phase 3 — Form smart defaults** (this round):
  - `AddExpense`: default wallet to first wallet, currency symbol.
  - `CreateTask`: `Today / Tomorrow / Weekend` chips.
- **Backlog** (deferred — too large for one round):
  - Onboarding 5→3 step rewrite.
  - Date/time pickers across all forms.
  - Voice STT wiring.
  - `EmailVerifyBanner` session dismissal.
  - Tab icon set replacement.

See `docs/MOBILE_REDESIGN_PLAN.md` Phase C/E/G/I for the deferred items.
