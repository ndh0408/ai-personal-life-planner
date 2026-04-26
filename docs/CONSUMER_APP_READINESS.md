# Consumer App Readiness — Round 20.5

This doc summarises how Round 20.5 moves LifeOS AI mobile from "demo
polish" to "consumer-grade fast path". The follow-on backlog (full
onboarding rewrite, voice STT, date/time pickers) is captured in
`docs/UX_SIMPLIFICATION_AUDIT.md` §F.

---

## What was the problem

The mobile app already had a strong design system + real backend
wiring, but three friction sources kept it feeling internal:

1. **AI provider setup** required users to pick from 6 providers and
   fill 6 task-specific model fields — utterly opaque to a consumer.
2. **No CTA on Home** for the most important first action ("enable
   AI"). Users had to *discover* `Settings → AI provider → Add` on
   their own.
3. **Quick Capture** depended on AI being configured, so users with
   no key got nothing.

Plus assorted form friction (no smart wallet default, no due-date
chips, voice section pretending to work).

## What changed

### Backend
- New `POST /user-ai-providers/openai-simple` endpoint that accepts
  *just* an `apiKey`. Auto-fills name/baseUrl/model, runs an upstream
  probe, rolls back on failure, and flips the user's `useOwnApiKey`
  preference so AI features unlock immediately on success.
- New `OPENAI_DEFAULT_MODEL` env (default `gpt-4o-mini`) — bumpable
  without a mobile release.
- All existing security invariants preserved: encryption-at-rest via
  `EncryptionService`, never-log-key audit trail, IDOR-safe via
  per-user filter, throttle 5/min on the new route.

### Mobile (consumer surfaces)
- New `AISetupScreen` — one input + Test + Save + skip.
- Rewritten `AiProviderSettingsScreen` — hero card for the simple
  flow, Advanced fold for the full multi-provider form.
- New rule-based Quick Capture parser — works without AI for
  Vietnamese + English shorthand expense/task lines.
- Rewritten `QuickCaptureScreen` — example chips, draft cards with
  confirm/discard, opt-in AI fallback button when a provider exists.
- Dashboard hero CTA + Quick Capture entry chip.
- Smart defaults: AddExpense auto-selects first wallet; CreateTask
  has `Today / Tomorrow / Weekend / No due` chips.

### i18n
- New `errors.OPENAI_KEY_INVALID`, `errors.AI_DAILY_LIMIT_REACHED`,
  `errors.EMAIL_VERIFICATION_RESEND_RATE_LIMITED`,
  `errors.CONCURRENT_WRITE` — full vi/en parity.
- New `settings.aiSetup.*`, `settings.quickCapture.*` (rewritten),
  `settings.aiProviders.advanced*`, `dashboard.aiCta.*`,
  `dashboard.captureCta.*`, `tasks.form.dueChips.*` blocks.

## What still feels demo (deferred)

| Surface | Status | Why deferred |
|---------|--------|--------------|
| Voice STT | placeholder copy | needs server STT integration; large scope |
| Onboarding 5→3 step | unchanged | needs UX flow rework + back-compat draft store |
| Date/time pickers | bare text inputs | needs picker library evaluation |
| Tab icon set | emoji-only | needs icon-set design pass |
| `EmailVerifyBanner` dismiss | persistent | needs preference storage |

These are tracked in `docs/UX_SIMPLIFICATION_AUDIT.md` §F.

## How to verify

```bash
npm run build:shared
npm run --workspace apps/api typecheck   # passes
npm run --workspace apps/api test -- --testPathPattern user-ai-provider  # 6/6
# Mobile typecheck has a pre-existing JSX-types baseline issue
# (TS2786 affects every screen project-wide). Filter for non-JSX errors:
#   npm run --workspace apps/mobile typecheck 2>&1 \
#     | grep "error TS" | grep -v "TS2786\|TS2607"
# Round 20.5 introduces zero new entries on that filter.
```

Then follow `docs/MOBILE_WORKFLOW_QA.md` for manual UX checks.

## Files changed (top level)

```
docs/UX_SIMPLIFICATION_AUDIT.md            (new — this round's audit)
docs/MOBILE_REAL_WORKFLOW_AUDIT.md         (new — real-vs-fake audit)
docs/AI_SETTINGS_UX.md                     (new)
docs/QUICK_CAPTURE_UX.md                   (new)
docs/MOBILE_WORKFLOW_QA.md                 (new)
docs/CONSUMER_APP_READINESS.md             (this file)

packages/shared/src/schemas/user-ai-provider.schema.ts  (+QuickOpenAiSetup)
apps/api/src/modules/user-ai-providers/*.ts             (+createOpenAiSimple)
apps/api/src/config/env.validation.ts                   (+OPENAI_DEFAULT_MODEL)

apps/mobile/src/screens/settings/AISetupScreen.tsx              (new)
apps/mobile/src/screens/settings/AiProviderSettingsScreen.tsx   (rewritten)
apps/mobile/src/screens/voice/QuickCaptureScreen.tsx            (rewritten)
apps/mobile/src/screens/dashboard/DashboardScreen.tsx           (CTA + entry)
apps/mobile/src/screens/finance/AddExpenseScreen.tsx            (smart wallet)
apps/mobile/src/screens/tasks/CreateTaskScreen.tsx              (due chips)

apps/mobile/src/services/quickCapture/ruleParser.ts             (new)
apps/mobile/src/services/api/user-ai-providers.api.ts           (+simple)
apps/mobile/src/navigation/RootNavigator.tsx + types.ts         (+route)
apps/mobile/src/i18n/locales/{en,vi}.json                       (parity)
```
