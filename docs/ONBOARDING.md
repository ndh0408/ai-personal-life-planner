# LifeOS AI — Onboarding

The first-launch flow. Three steps, ≤ 60 seconds, never traps the user.

> Screens: `apps/mobile/src/screens/onboarding/`.
> Profile API: `apps/api/src/modules/user-profile/`.
> Wire format: `packages/shared/src/profile.ts`.

---

## The three steps

### Step 1 — Welcome + Language
`WelcomeScreen.tsx`

- Big display title + a one-sentence intro.
- Language picker: two `<Chip tone="accent">` chips (Tiếng Việt / English).
  Locale auto-detected on first boot from `react-native-localize`; user
  can flip it before continuing.
- CTA "Bắt đầu" → BasicSetup.

No persistence here — language change applies at runtime via
`i18n.changeLanguage()`. Server profile gets the locale on the next PATCH.

### Step 2 — Basic Setup
`BasicSetupScreen.tsx`

- **Preferred name** — single `<TextField>`, optional.
- **Mục tiêu chính** — six chips, multi-select:
  Làm việc hiệu quả · Quản lý tiền · Ngủ nghỉ tốt hơn · Ăn uống tốt hơn ·
  Duy trì thói quen · Cân bằng cuộc sống.
  Backend stores the keys (`work / money / sleep / eat / habit / balance`)
  in `UserProfile.mainGoals` (Json column).
- **Thường thức dậy lúc** + **Thường ngủ lúc** — chips of preset HH:mm.
  Hidden behind a "Bỏ qua mục giờ" toggle for users who don't have a
  routine yet.
- Two CTAs: "Tiếp tục" (saves profile + advances) and "Bỏ qua" (advances
  without saving the soft fields — preferred name still saves if filled).

PATCH lands at `/api/profile`:
```json
{
  "preferredName": "Huy",
  "mainGoals": ["save_money", "sleep_better"],
  "usualWakeTime": "06:30",
  "usualSleepTime": "23:00"
}
```

### Step 3 — AI Setup
`AISetupScreen.tsx`

- One paste field for the OpenAI key, hidden by default with an eye toggle.
- "Lưu & kiểm tra" runs the live test against `/v1/models`; on success
  the key is encrypted with AES-256-GCM and stored.
- "Bỏ qua, làm sau" — proceeds without a key. Home will then show the
  "Bật AI để bắt đầu" hero with a CTA back to AI Settings.
- "Tôi chưa có key" opens an instructional bottom sheet with the four
  steps to grab a free OpenAI key.

When the user finishes (either by saving or skipping), the auth store
flips `stage` to `ready` and the RootNavigator swaps in the MainStack.

---

## Stage transitions

```
RootNavigator (driven by useAuthStore.stage)
  unauthenticated  ─ login / register ─▶  onboarding
  onboarding       ─ skip / save key ──▶  ready

OnboardingStack
  Welcome ─▶ BasicSetup ─▶ AISetup
                             │
                             ├─ saveAndContinue ─▶ markAiKeyConfigured(true)
                             └─ skip ────────────▶ finishOnboarding()
```

The `onboardingCompletedAt` timestamp on `UserProfile` is set when
BasicSetup PATCHes with `completeOnboarding: true` (or, in a future
round, when AISetup finishes — currently the field is set on first
PATCH which is a "good enough" approximation).

---

## Privacy + safety

- The AI key never leaves the device unencrypted. The Save button calls
  `/api/ai-key/setup-openai` over HTTPS; the API tests the key, encrypts
  it (AES-256-GCM), then drops the plaintext from React state via
  `reset({ apiKey: '' })`.
- Skipping AI doesn't lock anything — the user reaches Home and can add
  a key from Settings any time.
- Profile fields are user-owned. Account deletion cascades through every
  table per [SECURITY_PRIVACY.md](./SECURITY_PRIVACY.md).

---

## Rules the screens follow (UX_PRINCIPLES)

- Each step is ≤ 60 seconds for a fast user.
- Every required field is the absolute minimum.
- Skip exists for everything optional.
- No "you'll see this later" placeholder content.
- Errors come from the server's stable `errorCode` → mapped to vi/en
  via the i18n catalog.

---

## Verified flow

- Register → unauthenticated → onboarding (Welcome → BasicSetup → AISetup).
- Skipping AI: lands on Home with the "Bật AI để bắt đầu" hero.
- Saving AI: lands on Home with the "Hôm nay bạn muốn làm gì?" hero +
  the AI status pill in the header.
- BasicSetup PATCH to `/api/profile` returns 200 with the saved row;
  `dashboard/summary` then reflects the goals (when other modules
  consume them).
