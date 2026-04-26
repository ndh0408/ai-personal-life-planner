# Round 21 — full mobile polish

**Date:** 2026-04-26
**Theme:** "make it actually work, no demo, no coming-soon."

Round 20.5 introduced the consumer-grade AI setup + Quick Capture
shortcuts. Round 21 finishes the consumer polish: 3-step onboarding,
restructured Dashboard, real Whisper-backed voice, AI guards on every
AI surface, vector tab icons, responsive layouts, and smart defaults
across forms. This doc summarises what shipped and how to verify it.

---

## 1. Onboarding 5 → 3 steps

Old: Welcome → Profile → Goal → Schedule → Finance (≈21 fields).
New: **Welcome → Basics → AI setup** (≈3 required fields).

- `apps/mobile/src/store/onboarding.store.ts` — defaults updated;
  timezone is now auto-detected via `expo-localization`.
- New screens:
  - [`OnboardingBasicsScreen`](../apps/mobile/src/screens/onboarding/OnboardingBasicsScreen.tsx)
    — name + main goal chip grid + collapsed sleep/wake.
  - [`OnboardingAISetupScreen`](../apps/mobile/src/screens/onboarding/OnboardingAISetupScreen.tsx)
    — wraps the same `POST /user-ai-providers/openai-simple` flow,
    finalises onboarding on success or skip.
- Old screens (`OnboardingProfile`, `OnboardingGoal`,
  `OnboardingSchedule`, `OnboardingFinance`) deleted.
- `OnboardingStackParamList` shrunk to `Welcome | Basics |
  AISetupOnboarding`.

Body metrics, salary, wallet toggles, and detailed schedule moved to
profile/finance settings (still editable later).

## 2. Dashboard restructure (per spec §5)

[`DashboardScreen`](../apps/mobile/src/screens/dashboard/DashboardScreen.tsx)
re-laid out as:

1. EmailVerifyBanner (when unverified).
2. Header — greeting + date + status chip ("Sẵn sàng" / "Cần chú ý" /
   "Chưa bật AI").
3. Hero card — primary tone "Bật AI để bắt đầu" when no provider;
   surface tone "Hôm nay bạn muốn làm gì?" otherwise. Hero CTA
   either opens today's plan or generates one.
4. Quick actions — responsive grid (2 / 3 / 4 cols) of Ionicons
   buttons: Quick capture, Add expense, Add task, Check-in, AI
   schedule, Ask AI.
5. Assistant highlight (if any).
6. Today plan card (existing data, gated by `useAiGate()`).
7. Money snapshot (income / expense / remaining) with budget warnings.
8. Health insight grid (sleep / mood / meals / habits) — wraps to two
   columns on tablet.
9. Top tasks card.
10. Goals progress.

All AI-triggered actions (generate plan, regenerate, ask AI) route
through `useAiGate()` — no provider → modal → AISetup.

## 3. Voice STT — real Whisper integration

Round 21 turns the previously-stubbed `/voice/transcribe` route into a
real Whisper-backed pipeline.

**Backend** (`apps/api/src/modules/voice-companion/speech-to-text.service.ts`):
- Looks up the caller's active OpenAI provider row.
- Decrypts the API key (held only for the call's duration).
- Sends `multipart/form-data` to OpenAI's
  `/v1/audio/transcriptions` endpoint with the recorded audio.
- Returns `{ transcript, locale }`. When the user has no OpenAI key
  the response is `{ transcript:'', notImplemented:true }` so the
  mobile UI can prompt them to add one.
- Audio is **never persisted** server-side; the decrypted key is
  **never logged**; only metadata (provider, model, byte size, ok,
  latency) hits the audit log.
- Throttled at 10 / minute per user.
- New env: `OPENAI_WHISPER_MODEL` (default `whisper-1`).

**Mobile** (`apps/mobile/src/hooks/useVoiceRecorder.ts`):
- Press-and-hold pattern via `expo-av` + new `expo-file-system` API
  (`File.base64()`).
- Mic is OFF until the user holds the button. Permission prompted on
  first use.
- The recorded file is deleted from the cache as soon as it's
  base64-encoded — no on-device persistence.
- New deps: `expo-av` (16.0.8). Already-installed `expo-file-system`
  is used via the new `File` API.
- `app.config.ts` now declares `NSMicrophoneUsageDescription` (iOS)
  + `RECORD_AUDIO` permission (Android) + the `expo-av` plugin.

**UI** (`QuickCaptureScreen`): the mic is rendered as a 88pt circular
press-and-hold button. While recording it turns danger-tone with a
stop icon and a live timer. Releasing transcribes via the backend and
auto-runs the rule parser on the result so the user sees a draft
without an extra tap.

## 4. AI feature guards

New hook [`useAiEnabled` / `useAiGate`](../apps/mobile/src/hooks/useAiEnabled.ts)
piggybacks on the existing `aiProviders` query. When the user hits an
AI feature without a configured provider:

- An alert pops up with the localised `AI_PROVIDER_NOT_CONFIGURED`
  copy.
- The CTA routes to `AISetup`.

Wired into:
- DashboardScreen — generate plan, ask AI, regenerate buttons.
- TodayScreen — `requestGenerate` + `imLate` reschedule.
- MealsScreen — `setAiOpen(true)` AI-suggest CTA.
- AssistantScreen — `askAi(r)` per recommendation.
- AIChatScreen — `send()` on every message.

## 5. Tab icons (Ionicons)

[`MainTabsNavigator`](../apps/mobile/src/navigation/MainTabsNavigator.tsx)
swaps emoji for `@expo/vector-icons` Ionicons. Filled when focused,
outline when not. Icon + bar height + label size scale with
`useResponsive()` — small phones get a 56pt bar with 10pt labels,
tablets get a 76pt bar with 26pt icons.

## 6. Responsive layout

New token + hook in [`apps/mobile/src/theme/responsive.ts`](../apps/mobile/src/theme/responsive.ts):

- Breakpoints: `xs` (≤360), `sm` (361–479), `md` (480–767), `lg`
  (768–1023), `xl` (≥1024).
- `useResponsive()` returns `{ width, height, bp, atLeast, below,
  isTablet, isCompact, gridColumns, pick }`.
- `gridColumns` returns 2 / 3 / 4 — used by Dashboard quick actions
  and Onboarding Basics chip grid.
- Redesigned screens (Dashboard, Onboarding Welcome / Basics / AI
  setup, QuickCapture) cap content width on tablets so layouts don't
  stretch awkwardly on iPad.

## 7. Smart defaults

- `AddExpenseScreen` — auto-pick first wallet (Round 20.5).
- `CreateTaskScreen` — Today / Tomorrow / Weekend / No-due chips
  (Round 20.5).
- `AddBudgetScreen` — category chip grid (food / transport / housing
  / utilities / shopping / entertainment / health / education) with a
  free-text fallback for custom categories.
- `SleepMoodCheckinScreen` — four quick presets (`great` / `normal` /
  `short` / `tired`) that set sleep window + quality + mood + energy
  + stress in one tap.

## 8. EmailVerifyBanner polish

`Dismiss` text replaced with an Ionicons close glyph + accessibility
label. Session-scoped dismiss behaviour preserved.

## 9. i18n parity

Vi / en parity verified — `0` missing keys after the round.

```
node -e "..." # see apps/mobile/scripts/check-i18n.js (or run inline)
```

## 10. Quality

```
npm run build:shared                    # passes
npm run --workspace apps/api typecheck  # passes
npm run --workspace apps/api test -- --testPathPattern user-ai-provider  # 6/6 pass
npx expo install --check                # "Dependencies are up to date"
```

Mobile `tsc --noEmit` baseline (project-wide TS2786 / TS2607 noise)
remains; Round 21 changes net **−13 non-JSX errors** vs. master pre-
round.

## 11. What this round does NOT touch

- Date/time picker library — chips cover the common cases. A real
  calendar picker would need a native module + EAS rebuild and a
  dedicated UX pass.
- Tablet-specific master-detail layouts (split nav) — single-pane
  layouts with `maxWidth` caps look good on iPad portrait but a
  split-view will land in a future round.
- Dark/light theme polish for the new vector icons (uses theme
  `primary` / `textMuted` already, so the contrast is correct, but
  pixel-level tuning is out of scope).
- The original "Voice Companion" hub screen is renamed to **Smart
  shortcuts**. It's still in Settings as a routing index.
