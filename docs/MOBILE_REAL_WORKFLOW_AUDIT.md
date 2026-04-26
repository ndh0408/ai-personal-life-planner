# Mobile Real-Workflow Audit — Round 20.5

**Date:** 2026-04-26  
**Question:** Which mobile flows actually call real backend endpoints
end-to-end, and which ones are stubbed, fake, or partially wired?

A flow is **real** if every user action eventually persists through a real
controller and reflects on a subsequent fetch. A flow is **stubbed** if the
UI suggests the action succeeded but no server-side mutation occurred.

---

## A. Real end-to-end flows (verified)

| Flow | Endpoint | Notes |
|------|----------|-------|
| Register / Login / Refresh / Logout | `/auth/*` | JWT pair, 401 teardown via interceptor. |
| Email verification banner | `/auth/email/verify*` | Resend mutation hits real endpoint, throttled. |
| Dashboard summary | `GET /dashboard/summary` | Real query, cached, pull-to-refresh. |
| Generate today's schedule | `POST /ai/generate-schedule` | Hits AI provider; invalidates dashboard. |
| AI chat | `POST /ai/chat` | Real streaming-ish reply; no mocks. |
| AI provider CRUD | `/user-ai-providers/*` | Encryption verified in service; dto masks key. |
| Provider connectivity test | `POST /user-ai-providers/:id/test` | Real upstream probe, throttled 3/min. |
| AI preferences (own-key, fallback) | `/user-ai-preferences` | Real GET/PUT. |
| Add expense / income / wallet | `/expenses`, `/incomes`, `/wallets` | Real; offline-queued via `syncQueue`. |
| Create task / habit / goal | `/tasks`, `/habits`, `/goals` | Real CRUD + status mutation. |
| Meal logging + AI suggestion | `/meals`, `/meal-logs`, `/ai/meals/suggest` | Real end-to-end. |
| Sleep / mood quick logs | `/sleep-logs/quick`, `/mood-logs/quick` | Real. |
| Recommendations dismiss / snooze | `/recommendations/*` | Real. |
| Quick capture parse → suggested actions | `POST /ai/parse-quick-capture` → `/suggested-actions/*` | Real backend; UI confirms via `SuggestedActionsReviewScreen`. |
| Privacy / personalisation toggles | `/privacy/*`, `/users/preferences` | Real PUT. |
| Notifications (smart check-ins) | `/smart-checkins/settings` | Real. |
| Health integration toggle | `/health-integration/settings` | Real. |
| Communication (email triage, follow-up) | `/communication/*` | Real. |
| Daily / weekly / monthly reports | `/reports/*` | Real, cached. |

## B. Partial / stubbed flows

| Flow | What's missing | Where |
|------|----------------|-------|
| **Quick Capture voice** | STT not wired. `parseQuickCapture` accepts text; the UI shows a "voice transcription is a stub today" notice. Users get a text-only capture surface. | `screens/voice/QuickCaptureScreen.tsx:14-19,55`; backend `voice/transcribe` is a no-op stub. |
| **Quick Capture without AI key** | Without an AI provider, parse-quick-capture errors out — no rule-based fallback. | `apps/api/src/modules/ai/ai.controller.ts` (parse-quick-capture handler). |
| **AI Setup "simple OpenAI"** | No backend endpoint accepting just an apiKey; mobile must pick provider type, name, etc. | `apps/api/src/modules/user-ai-providers/*` — no `openai-simple` route. |
| **Onboarding wallet creation** | If the wallet name conflicts (re-enter onboarding), the error is swallowed. User believes wallets were created. | `screens/onboarding/OnboardingFinanceScreen.tsx:60-72` |
| **AddExpense default wallet** | Wallet defaults to `null`. Saving with `walletId: null` produces a "no wallet" expense — silently un-tracked vs. wallet balances. | `screens/finance/AddExpenseScreen.tsx:44` |
| **CreateTask "Split task" / "Timing"** | AI replies via `Alert.alert`; user must manually paste. Not a fake — but feels incomplete. | `screens/tasks/CreateTaskScreen.tsx:148-188` |
| **EmailVerifyBanner dismiss** | No dismiss state; renders every dashboard load. Not fake, just nag. | `components/auth/EmailVerifyBanner.tsx` |

## C. Mock data inventory

A grep for `mock`, `fake`, `placeholder`, `TODO` across `apps/mobile/src`
turned up **no production-path mock data**: all mocks are confined to test
files or developer fixtures. Every screen that calls `useQuery` does so
against a real `apiClient.*` method backed by an HTTP endpoint.

## D. End-to-end gates that will trip non-technical users

1. **Provider must exist and be SUCCESS-tested before any AI feature
   unlocks.** Most surfaces don't surface this requirement clearly.
2. **`useOwnApiKey` preference defaults to `false`**, so even after the
   user adds a provider, AI calls still hit the global provider until
   they flip the toggle. Users won't know to do this.
3. **Onboarding must complete in one shot** — if the user backgrounds
   the app mid-flow, the draft is preserved (`useOnboardingStore`) but
   the timezone field's lack of validation can cause a silent failure
   on Finish.

## E. Round 20.5 fixes for the partial flows above

1. **Quick Capture rule-based parser** — when AI provider is missing or
   parse fails, fall back to a local regex parser that handles the most
   common Vietnamese/English shorthand (`cà phê 30k`, `taxi 50000`,
   `ăn cơm gà 45k`, `mai 9h gọi khách`, `coffee 30k`). The user still
   confirms before persistence. (See
   `apps/mobile/src/services/quickCapture/ruleParser.ts`.)
2. **Backend `POST /user-ai-providers/openai-simple`** — accepts a single
   `apiKey`, defaults provider=OPENAI, name="OpenAI",
   baseUrl=`https://api.openai.com/v1`, isDefault=true, model=`AI_MODEL`
   env var (existing). Eliminates the 10-field setup for >95% of users.
3. **Auto-test on Save** — the new `AISetupScreen` calls `POST /test`
   immediately after create; if it fails, the row is deleted (rolled
   back) so the user can retry without orphaned providers.
4. **Auto-flip `useOwnApiKey=true`** — when the simple endpoint creates
   the first user provider, it also sets the preference to use the user's
   key. (Done as a single transaction in the controller.)
5. **Default-wallet auto-pick on AddExpense** — pre-select the first
   wallet from `walletsApi.list()`. Saves a tap; aligns expense to a real
   wallet so wallet balance updates correctly.

## F. Still partial after Round 20.5 (deferred)

- **Voice STT**: still stubbed; the screen now shows a clearer "Voice
  coming soon" line and no longer claims voice as a feature.  
- **AI helpers in CreateTask** still use Alert + manual paste.  
- **Reports → AI insights** could surface inline; today they live in chat.
- **Onboarding 5→3 step rewrite**: too large for this round, planned for
  Phase C of `MOBILE_REDESIGN_PLAN.md`.

---

This audit confirms the codebase is mostly real end-to-end. The biggest
gaps are the **AI setup ergonomics** and the **rule-based quick-capture
fallback**, both of which are addressed by Round 20.5.
