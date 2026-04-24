# Mobile auth + onboarding

Full end-to-end auth + onboarding flow for LifeOS AI mobile.

## Auth lifecycle

```
App boots
  │
  ▼
RootNavigator renders <Splash/>, triggers useAuthStore.hydrate()
  │
  ├─ No access token in SecureStore → Auth stack (Login / Register)
  │
  └─ Token exists → GET /api/me
        ├─ 200 → GET /api/profile
        │        ├─ exists=false OR "skeleton" profile (age/mainGoal/
        │        │   activityLevel/usualWakeTime all null)
        │        │        → Onboarding stack
        │        └─ profile has real data
        │                 → apply profile.locale → Main tabs
        └─ 401  → clear tokens + unauthenticated
```

### Token storage

- **accessToken** + **refreshToken** live in `expo-secure-store` (iOS Keychain / Android Keystore) via `src/services/auth/token-store.ts`. AsyncStorage fallback on web.
- The API client (`src/services/api/client.ts`) attaches `Authorization: Bearer <access>` on every request (except `auth: false` paths).
- On **401** with a valid refresh token: the client fires one `POST /auth/refresh` (singleton, not parallel), swaps the tokens, retries the original request once. If the retry still fails or refresh fails, `registerUnauthorizedHandler` flips the auth store to `unauthenticated` and clears tokens.

### Logout

`useAuthStore.logout()` calls `POST /auth/logout` (best-effort), clears the token store, and resets the store to `unauthenticated, user=null, profile=null`. Subsequent requests route straight to the Auth stack.

### Routing decision

`RootNavigator.tsx`:

```tsx
{status === 'loading'         ? <Splash/>
 : status === 'unauthenticated' ? <AuthNavigator/>
 : needsOnboarding              ? <OnboardingNavigator/>
 : <MainTabsNavigator/>  + secondary screens + modal group}
```

`needsOnboarding` is `true` when the server's `/profile` returns `exists=false` OR the row exists but every onboarding-relevant field is null (which is exactly what fresh registers look like — the auth service creates an empty UserProfile at register time).

## Onboarding (5 steps)

Progress: horizontal 5-segment bar via `<StepProgress total={5} current={n} />`.

All step answers live in a **single in-memory Zustand store** (`src/store/onboarding.store.ts`). Back/Next never loses data because we read/write the same `draft` object. Step 5's submit is the only write to the server; on success it resets the draft + flips `completeOnboarding()` which navigates to Dashboard.

| Step | Screen | Collects |
| --- | --- | --- |
| 1 | `OnboardingWelcomeScreen` | Locale pick (vi / en). Calls `setLocale()` immediately so the rest of the flow is localized. CTA → Profile. |
| 2 | `OnboardingProfileScreen` | `fullName*`, `age*`, `gender?`, `heightCm?`, `weightKg?`, `occupation?`. Client-side: fullName non-empty, age 1..120. |
| 3 | `OnboardingGoalScreen` | `mainGoal*` (9 options), `activityLevel*`, `dietaryPreference?`, `healthNotes?`. |
| 4 | `OnboardingScheduleScreen` | `workStartTime`, `workEndTime`, `usualWakeTime`, `usualSleepTime`, `timezone`. All HH:mm validated client-side. Sensible defaults pre-filled (09:00 / 18:00 / 06:30 / 23:00 / Asia/Ho_Chi_Minh). |
| 5 | `OnboardingFinanceScreen` | `monthlySalary?`, `salaryDay? (1..31)`, `currency` (default VND), toggles for Cash wallet + Bank wallet + "want a monthly budget?" hint. |

### Finish action

`OnboardingFinanceScreen.finish()`:

1. **`PUT /api/profile`** with the full draft (finance fields use the Decimal-friendly `monthlySalary: number` shape from `@planner/shared.UpdateProfileSchema`).
2. **Create default wallets** in parallel via `POST /api/wallets` — Cash and/or Bank per the toggles. Individual failures are swallowed so a duplicate-name retry doesn't block the user.
3. **Persist locale** via `setLocale()` (also sent in the profile PUT for backend-side AI language).
4. **Reset the onboarding draft**.
5. **`useAuthStore.completeOnboarding(profile)`** → `needsOnboarding = false` → RootNavigator swaps to MainTabsNavigator.

If the backend call fails, the user stays on step 5 with an alert showing the localized `errorCode`.

## Language change (Settings → Language)

`LanguageSettingsScreen` enforces the four-step flow from the product spec:

1. **In-memory swap** — `i18n.changeLanguage(code)` fires a re-render everywhere `useTranslation()` is used.
2. **Persist locally** — AsyncStorage under `lifeos.locale`, survives reloads.
3. **Sync to backend** — if authenticated, `PUT /api/profile { locale }` so the next session boots into the chosen language AND the AI reply language matches (`LocaleService.forUser` on the backend reads `UserProfile.locale` first).
4. **Refresh auth store** — `useAuthStore.refreshProfile()` pulls the updated profile so any consumer sees the new value.

On auth boot, `hydrate()` also reads `profile.locale` and calls `setLocale` so the first render of any screen is already in the user's chosen language — no English flash.

## Tests (happy paths to walk through manually)

All four paths are runnable against the seeded server right now:

**A. Register → onboarding → Dashboard**
1. Launch app, tap "Sign up", pick email + password ≥8 chars.
2. Lands on Welcome — pick language (vi/en) → step 2.
3. Fill required fields through step 5, tap Finish.
4. Should arrive on Dashboard with the selected locale + Cash/Bank wallets already in Finance → Wallets.

**B. Login back in**
1. Logout from Profile → Settings.
2. Launch app / reopen — Auth stack shows in the previously chosen locale.
3. Login with the same credentials → straight to Dashboard (no onboarding).

**C. Logout**
1. Profile → Settings → Log out.
2. SecureStore cleared; confirm Auth stack renders and dev tools show no Bearer header on subsequent calls.

**D. Change language live**
1. While authenticated, Settings → Language → select the other locale.
2. Every screen re-renders in the new language, the tab bar labels flip, and the backend's next `POST /ai/chat` reply comes back in the chosen language.

## File inventory

**Updated:**
- `src/store/auth.store.ts` — tracks `profile` + `needsOnboarding`, runs `bootProfile()` during hydrate/login; `completeOnboarding` + `refreshProfile` helpers.
- `src/navigation/RootNavigator.tsx` — routes on `needsOnboarding`; Onboarding stack is only stacked onto Main when authenticated-with-profile.
- `src/navigation/OnboardingNavigator.tsx` — adds Finance as step 5.
- `src/navigation/types.ts` — `OnboardingStackParamList.Finance`.
- `src/screens/onboarding/OnboardingWelcomeScreen.tsx` — locale selector + i18n copy.
- `src/screens/onboarding/OnboardingProfileScreen.tsx` — form bound to onboarding store.
- `src/screens/onboarding/OnboardingGoalScreen.tsx` — 9 mainGoal chips + activityLevel.
- `src/screens/onboarding/OnboardingScheduleScreen.tsx` — HH:mm validation + sensible defaults.
- `src/screens/settings/LanguageSettingsScreen.tsx` — syncs to backend, refreshes profile on success.
- `src/services/api/profile.api.ts` — returns `monthlySalary/salaryDay/currency/locale`.
- `packages/shared/src/schemas/profile.schema.ts` — +`monthlySalary/salaryDay/currency` + 2 new MainGoal values.
- `apps/api/src/modules/profile/profile.service.ts` — serializes the new fields.
- `apps/mobile/src/i18n/locales/{vi,en}.json` — full `onboarding.*` block.

**New:**
- `src/store/onboarding.store.ts` — Zustand draft + `patch/reset`.
- `src/components/ui/StepProgress.tsx` — 5-segment progress bar.
- `src/screens/onboarding/OnboardingFinanceScreen.tsx` — step 5 + submit pipeline.

## Common pitfalls

- **Skeleton profile after a fresh register.** `authService.register` creates an empty `UserProfile` row — we detect that via the null-field heuristic, not via `exists=false`. If you later add a field users populate at register, re-check the heuristic.
- **Locale mismatch between device and backend.** Until the first `PUT /profile` locale, the backend's `forUser` falls back to `Accept-Language` from the device, then `"vi"`. This is fine — but don't assume `profile.locale` always matches the client until after onboarding finish or a Language settings change.
- **Shared schema rebuild.** If you change `packages/shared/src/schemas/profile.schema.ts`, run `npm run --workspace packages/shared build` so the api/mobile workspaces pick up the new types — typecheck will fail otherwise.
