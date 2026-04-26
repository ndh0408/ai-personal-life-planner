# Mobile Workflow QA Checklist — Round 20.5

Manual smoke-test checklist for the consumer-grade flow shipped in
Round 20.5. Tick boxes after running each on a real device or
simulator. **Backend must be reachable** at the URL configured by
`EXPO_PUBLIC_API_BASE_URL` (default: `https://api.tothanhthuy.cloud/api`).

---

## A. Auth

- [ ] Register → email + password → confirmation alert → Onboarding.
- [ ] Login with verified account → Dashboard.
- [ ] Login with unverified account → Dashboard with `EmailVerifyBanner`.
- [ ] Banner `Resend` button → success toast (or rate-limit error).
- [ ] Logout → returns to Login screen, clears tokens.
- [ ] Force-expire access token (wait or revoke) → next request triggers 401 teardown → returns to Auth.
- [ ] Forgot password flow → reset link → set new password.

## B. AI setup

- [ ] On a brand-new account, Dashboard shows the **"Enable AI to get
      started"** hero CTA.
- [ ] Tap CTA → `AISetupScreen` opens.
- [ ] Paste an obviously-invalid key (`sk-bad`) → after `Test and save`,
      backend rolls back; alert reads "API key invalid".
- [ ] Paste a known-good `sk-…` key → success alert; back to Settings →
      no orphaned providers.
- [ ] Settings → AI provider → confirms masked key + "Test passed" badge.
- [ ] Tap `Replace key` → `AISetupScreen` again; new key replaces silently.
- [ ] Tap `Remove` → confirm → key deleted, AI features re-locked.

## C. Advanced provider (power user)

- [ ] AI provider settings → flip `Advanced` toggle → list expands.
- [ ] Tap `Add provider` → existing form (full schema) → save NVIDIA key.
- [ ] List shows both rows; can flip default between them.

## D. Quick Capture (rule parser)

For each input the parser should produce a draft:

- [ ] `cà phê 30k` → expense, 30 000 VND, food.
- [ ] `ăn cơm gà 45k` → expense, 45 000 VND, food.
- [ ] `coffee 30k` → expense, 30 000 VND, food.
- [ ] `taxi 50000` → expense, 50 000 VND, transport.
- [ ] `mai 9h gọi khách` → task, due tomorrow 09:00.
- [ ] `nhắc tôi trả lời email lúc 8h` → task, due today/tomorrow 08:00.
- [ ] `tomorrow 9am call client` → task, due tomorrow 09:00.
- [ ] Random gibberish → "I couldn't recognise an action…".
- [ ] Confirm an expense draft → expense persists; wallet balance updates.
- [ ] Confirm a task draft → task appears in Tasks list.
- [ ] Discard a draft → no API call; draft list shrinks.
- [ ] Example chip tap populates the input.

## E. Quick Capture (AI fallback, requires provider)

- [ ] Type a complex sentence → tap `Use AI for richer parsing` → backend
      `POST /ai/parse-quick-capture` runs → routes to
      `SuggestedActionsReview`.
- [ ] When no provider exists, the `Use AI…` button is hidden.

## F. Dashboard

- [ ] Pull to refresh → fetches latest summary.
- [ ] Greeting reflects current local hour (morning / afternoon / evening).
- [ ] Quick Capture hero card visible; tapping opens `QuickCaptureScreen`.
- [ ] Quick Actions row contains ⚡ Quick capture chip.
- [ ] AI generate-schedule button works when provider is configured;
      surfaces friendly error otherwise.

## G. Add Expense (smart defaults)

- [ ] First wallet auto-selected on a fresh open.
- [ ] Tapping a different wallet chip respects user choice; auto-pick
      doesn't fight back on subsequent renders.
- [ ] Tapping `No wallet` chip leaves walletId null without re-pick.

## H. Create Task (due chips)

- [ ] `Today` chip sets dueDate to today 18:00 local.
- [ ] `Tomorrow` chip sets dueDate to tomorrow 18:00.
- [ ] `This weekend` chip sets dueDate to next Saturday 09:00.
- [ ] `No due` chip clears the field.
- [ ] Manual edit of the dueDate input still works alongside chips.

## I. Error UX

- [ ] Force backend offline → AI surfaces show `errors.NETWORK` not raw HTTP.
- [ ] Provider test failure shows `OPENAI_KEY_INVALID` for a 401-style
      response, `AI_PROVIDER_TEST_FAILED` for transport errors.
- [ ] No raw stack traces, Prisma codes, or upstream JSON visible to user.

## J. i18n parity

- [ ] Switch language to VI → all new strings render in Vietnamese
      (no missing-key warnings in Metro logs).
- [ ] Switch back to EN → mirror.

## K. Production polish

- [ ] No `console.log` of API key or token in Metro logs after a full
      AISetup → save → success cycle.
- [ ] No `localhost` references in the running production bundle.
- [ ] Forms scroll above the keyboard; submit buttons remain reachable.
- [ ] Pull-to-refresh works on Dashboard, Tasks, Expense list.

---

## Known-deferred (NOT covered)

- Voice STT (placeholder copy; no recording).
- Onboarding 5→3 step rewrite.
- Date / time pickers across all forms.
- Tab-icon set replacement.
- `EmailVerifyBanner` session-scope dismissal.

These ship in subsequent rounds (see
`docs/UX_SIMPLIFICATION_AUDIT.md` §F).
