# LifeOS AI — Round 16: Audit fixes + responsive pass

A deep audit pass over the mobile app surfaced 4 ship-blocking bugs, 11
quality issues, and 9 polish items. Round 16 fixes all of them and adds
a responsive layout system covering small phones → tablets.

> Mobile: `apps/mobile/`
> No backend changes (audit was mobile-only).

---

## P0 — Ship-stopping fixes

### 1. Onboarding was throwing user data on the floor
**`apps/mobile/src/screens/onboarding/BasicSetupScreen.tsx`**
The `handleSubmit` callback received form values and ignored them entirely.
preferredName, usualWakeTime, usualSleepTime — **never saved**. Comment said
"Profile persistence wires up in the next round" but it never got wired.

Fix: PATCH `/profile` with the values + `completeOnboarding: true` before
navigating to AISetup. Added a "Bỏ qua" ghost button so users with no time
preferences can still proceed.

### 2. Rules of Hooks violation in SmartEntry preview
**`apps/mobile/src/screens/main/SmartEntryScreen.tsx`** (`PreviewCard`)
`useMemo` was called *after* the `if (preview.kind === 'UNKNOWN') return …`
early-return guard. In strict mode this crashes when the kind transitions
between known and UNKNOWN.

Fix: Move `useMemo` above the early return so hook order is stable.

### 3. SmartEntry race condition on fast typing
**`apps/mobile/src/screens/main/SmartEntryScreen.tsx`**
`useMutation` doesn't cancel in-flight requests. When the user types fast,
multiple `/capture/parse` requests fire and the last to *resolve* (not the
last to *send*) wins, so the preview can flash a stale parse from 200ms ago.

Fix: Replace the mutation with a plain async fetch + a per-request id ref.
Stale responses (where `myId !== reqIdRef.current`) become no-ops.

### 4. Two dead screens shipping in the bundle
**Deleted: `AddTaskScreen.tsx`, `AddExpenseScreen.tsx`**
Round 15 redirected every "Add" entry point to `SmartEntry` but left the
old screens registered in `RootNavigator` with zero callers. ~250 LOC dead
code in the bundle.

Fix: Delete the files, drop the routes, drop the i18n keys that only those
screens used.

---

## P1 — Quality fixes

### 5. BottomSheet was reading window dimensions at module load
`Dimensions.get('window').height` was a module-level constant — wrong on
foldables, wrong after keyboard animation, wrong after rotation. Switched
to `useWindowDimensions()` inside the component. Also wired
`useSafeAreaInsets().bottom` so the sheet content doesn't sit under the
home indicator on iPhone X+ / gesture-bar Androids. Added a 560dp width
cap so the sheet doesn't span 1024dp on tablets in landscape.

### 6. KeyboardAvoidingView was a no-op on Android
`AppScreen` passed `behavior={undefined}` on Android, which makes KAV do
nothing. Save buttons on AddTask / AddExpense / MealLog / SleepMoodCheckin
were covered by the soft keyboard. Switched to `behavior="height"` on
Android.

### 7. Three duplicated components
- `MealRowCard` was inlined in both `TodayScreen` and `MealLogScreen` (verbatim)
- `TaskRowCard` was inlined in both `TodayScreen` and `TasksScreen` (divergent date format)
- `makeKey()` for idempotency was inlined in `SmartEntryScreen` and `AddExpenseScreen`

Extracted: `components/today/TaskRowCard.tsx` (with `actions?` + `showFullDate`
props), `components/today/MealRowCard.tsx`, `utils/idempotency.ts`.

### 8. CapturePreviewSheet was regenerating the idempotency key on every parsed change
Original: `useMemo(() => …Date.now()…, [parsed])` — but `parsed` changes
through edits too. Switched to a `useRef` reset on first render of each
parse session — survives field edits + retries.

### 9. TodayScreen had no error state for plan
If `/daily-plan/today` failed and there was no cached data, the plan
section rendered as blank space. Added `plan.isError && !plan.data ?
<ErrorState onRetry={…} /> : null` branch. Also renamed the regenerate
button label from `common.retry` (generic error string) to `today.regeneratePlan`.

### 10. SleepMoodCheckin ignored the user's actual wake time
`buildSleepWindow(7)` — wake hardcoded to 07:00 regardless of the
`usualWakeTime` set in onboarding. Now reads `profile.usualWakeTime`
and uses it as the anchor; falls back to 07:00 only when missing.

### 11. Dead hooks + dead store stub
`useWeekExpenses` and `useExpensesSummary` (in `useFeed.ts`) had zero
imports anywhere — replaced by the `/finance/timeline` query in MoneyScreen
during round 15 but never deleted. `markBasicSetupDone` in `auth.store.ts`
was a body of `void get()` (literal stub) called from nowhere.

All deleted. `useFeedInvalidator` now invalidates the same 9 keys that
SmartEntry confirms invalidate, so HomeScreen Quick Capture confirms can't
leave stale `finance` / `incomes` / `wallets` / `dashboard` data.

### 12. HomeScreen cross-tab navigation was using `as never`
Three callsites doing `navigation.navigate('MainTabs', { screen: 'Today' }
as never)` — type holes that silently break on tab rename. Switched to
`navigation.getParent()?.navigate('MainTabs', { screen: '…' })` which
type-checks against the root stack.

### 13. AssistantScreen errors were misnamespaced
`readableError(e, t, 'auth')` for chat send errors → user saw "Email or
password incorrect" when the real failure was `AI_KEY_MISSING`.
Switched to `'assistant'` namespace + added `assistant.errors.{network,
AI_KEY_MISSING, RATE_LIMITED, unknown}` i18n keys for vi + en.

Also added `assistant`, `capture`, `onboarding`, `common` to the
`ErrorNamespace` union in `utils/error.ts`.

---

## P2 — Polish

| # | Fix |
|---|---|
| 14 | MainTabs height = `56 + insets.bottom` (was hardcoded 64) — Android gesture nav + iPhone X+ no longer clip labels |
| 15 | LoginScreen + RegisterScreen: `textContentType="emailAddress"` + `"password"`/`"newPassword"` for iOS keychain autofill |
| 16 | SmartEntry `formatLocal` honors `i18n.language` (en users no longer see Vietnamese dates) |
| 17 | `captureService.parse` uses `Intl.DateTimeFormat().resolvedOptions().timeZone` instead of hardcoded `Asia/Ho_Chi_Minh`. Hermes graceful fallback |
| 18 | Removed dead `SessionExpired` error class, dead `CACHE_KEYS`, dead `QK.me` / `QK.homeStats` constants |
| 19 | `APP_BUILD` bumped from `'round-7'` → `'round-16'`, `APP_VERSION` to `0.16.0` |
| 20 | TodayScreen "openTasks" + "openMeals" wrap in `Pressable` with `accessibilityRole="button"` (was bare Text onPress, invisible to screen readers) |
| 21 | SmartEntry preview: filter empty lines + use index in key to dedupe "" collisions |
| 22 | Removed stale duplicate `assistant` + `onboarding` i18n blocks |

---

## Responsive layout system

New file: **`apps/mobile/src/hooks/useResponsive.ts`**

Single hook returning device class + orientation + content max width +
horizontal padding + columns + font scale. Breakpoints chosen for the most
common Android / iOS form factors:

| Short edge | Class | Padding | Max width | Columns |
|---|---|---|---|---|
| < 360dp | `smallPhone` | 16 | edge-to-edge | 1 |
| 360-411 | `phone` | 24 | edge-to-edge | 1 |
| 412-599 | `largePhone` | 24 | min(width, 520) | 1 |
| ≥ 600 | `tablet` | 32 | 640 | 1 portrait / 2 landscape |

### Where it's applied

- **`AppScreen`** — sets horizontal padding + lateral margin so content
  centers + caps at max-width on tablets.
- **`MainTabs`** — tab bar height = `56 + insets.bottom`, paddingBottom
  follows the device's gesture bar.
- **`BottomSheet`** — width `min(screenW, 560)`, `paddingBottom = insets.bottom + spacing.lg`,
  height capped to `screenH - insets.top - 24`. Window dimensions reactive.
- **`QuickActionsRow`** — tile width: 96 (smallPhone) / 110 (phone) /
  124 (largeFont) / 130 (tablet). `minHeight: 48` for Android touch target.
  Added `accessibilityRole`.
- **`MoneyScreen`** — Thu/Chi stat cards stack vertically on smallPhone
  (< 360dp), row otherwise.

### What stayed responsive already

`StatCard` uses `flex: 1` so it always splits row width. Chip rows in
BasicSetup / SmartEntry / SleepMoodCheckin use `flexWrap: 'wrap'`. RN's
default `allowFontScaling: true` + matched lineHeight ratios keep
typography readable at 1.6× system font scale.

---

## Verification

```
✓ tsc --noEmit  (mobile + api)        — 0 errors
✓ jest          (api)                  — 54/54 pass
✓ APK release build                     — 58 MB
✓ adb install + launch on Xiaomi 13T   — Success
✓ Onboarding round-trip                — preferredName + wakeTime persisted to /profile
✓ SmartEntry "lương 15tr"              — INCOME / salary / 0.93 confidence
✓ SmartEntry rapid typing               — preview always matches the *latest* text
✓ MoneyScreen on Xiaomi 13T (412dp)    — stat cards row, tile widths match
```

---

## Stats

```
Files changed                         32
Insertions / deletions               +870 / -382
Dead screens removed                  2 (AddTaskScreen, AddExpenseScreen)
Dead hooks removed                    2 (useWeekExpenses, useExpensesSummary)
Dead exports removed                  3 (SessionExpired, CACHE_KEYS, QK.me/homeStats)
Dead store function removed           1 (markBasicSetupDone)
Duplicated components extracted       3 (TaskRowCard, MealRowCard, makeIdempotencyKey)
i18n keys added                      12 (assistant.errors.*, onboarding.errors.*, today.regeneratePlan)
i18n duplicate blocks merged          2 (assistant, onboarding)
Type holes closed                     3 (HomeScreen `as never` callsites)
```
