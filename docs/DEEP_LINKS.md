# Deep Links — LifeOS AI

**Source of truth in code:** `apps/mobile/src/services/widgets/deep-link.ts`, `apps/mobile/src/navigation/RootNavigator.tsx` `linking` config, `apps/mobile/app.config.ts` (`scheme: 'lifeos'`).
**Companion to:** [WIDGETS.md](./WIDGETS.md), [VOICE_COMPANION.md](./VOICE_COMPANION.md).

## 1. Scheme

```
lifeos://<head>[/<segment>...]
```

Registered in `app.config.ts` via the `scheme: 'lifeos'` field. Both iOS Universal Links / Android App Links can be added later for `https://app.<yourdomain>` mappings; the in-app `Linking` resolver handles both.

## 2. Routing strategy

Two parallel resolvers exist by design — they always agree on the same set of URLs:

| Resolver | Where it runs | Purpose |
|----------|---------------|---------|
| React Navigation `linking` config | inside `<NavigationContainer linking={...}>` in `RootNavigator.tsx` | Handles cold-launch + warm-launch URLs from the OS, mapping each path to a Stack.Screen automatically. Source of truth for the mapping. |
| `useDeepLinkRouter` + `dispatch` (in `services/widgets/deep-link.ts`) | inside any screen that wants to react programmatically | Used by the in-app preview (`fireDeepLink('lifeos://...')`) and by future programmatic Quick Actions. Also used to enforce the scheme allow-list (`u.protocol !== 'lifeos:'` → reject). |

If the two ever diverge, the React Navigation `linking` config wins (the OS hands the URL to it first); the helper exists for in-app testing.

## 3. Allowed URLs

Stable list — every URL is documented + tested + bound in both resolvers:

| URL | Opens | Source |
|-----|-------|--------|
| `lifeos://today` | Main tabs (Today landing) | Today widget tap |
| `lifeos://assistant` | Main tabs | AI Nudge widget "View" tap |
| `lifeos://ai-chat` | AIChatScreen | AI Nudge widget "Ask AI" |
| `lifeos://tasks/add` | CreateTaskScreen | Quick Capture widget |
| `lifeos://finance/add-expense` | AddExpenseScreen | Finance widget + Quick Capture |
| `lifeos://finance/add-income` | AddIncomeScreen | Finance widget + Quick Capture |
| `lifeos://meals/quick-log` | MealQuickLogScreen | Quick Capture |
| `lifeos://health/check-in` | SleepMoodCheckinScreen | Health widget |
| `lifeos://health/mood` | MoodQuickLogScreen | Health widget |
| `lifeos://health/sleep` | SleepQuickLogScreen | Health widget |
| `lifeos://recommendation/:id` | ContextInferencesScreen | AI Nudge widget tap |
| `lifeos://widget-settings` | WidgetSettingsScreen | in-app deeplink helper |

`KNOWN_DEEP_LINKS` in `deep-link.ts` is the authoritative array — keep this doc + the React Navigation `linking.config.screens` map in sync with it.

## 4. Hard rules

- **Scheme allow-list.** The dispatcher rejects every `protocol !== 'lifeos:'`. Other schemes (`http`, `file`, `gopher`, etc.) cannot trigger navigation.
- **No auto-mutate.** No deep-link writes data on its own — every URL opens a screen the user must confirm an action on. There is no `lifeos://complete-task/:id` because that would let an attacker craft a malicious URL.
- **Auth-gated screens.** When the dispatcher targets a screen that lives inside the post-auth navigator, React Navigation falls through to the auth landing if the user is signed out. Deep links never bypass auth.
- **Idempotent.** Tapping the same URL twice opens the same screen twice with no side effect (React Navigation handles the duplicate push).

## 5. Test commands

iOS Simulator:
```bash
xcrun simctl openurl booted lifeos://today
xcrun simctl openurl booted lifeos://tasks/add
xcrun simctl openurl booted lifeos://finance/add-expense
xcrun simctl openurl booted lifeos://meals/quick-log
xcrun simctl openurl booted lifeos://health/mood
xcrun simctl openurl booted lifeos://widget-settings
```

Android emulator:
```bash
adb shell am start -a android.intent.action.VIEW -d "lifeos://today"
adb shell am start -a android.intent.action.VIEW -d "lifeos://tasks/add"
adb shell am start -a android.intent.action.VIEW -d "lifeos://finance/add-expense"
adb shell am start -a android.intent.action.VIEW -d "lifeos://meals/quick-log"
adb shell am start -a android.intent.action.VIEW -d "lifeos://health/mood"
adb shell am start -a android.intent.action.VIEW -d "lifeos://widget-settings"
```

Each should open the matching screen. If `lifeos://` is not registered, restart the app after a fresh build (the scheme is baked into the binary at build time).

## 6. Roadmap

- v1.3: Add `https://app.<domain>/...` Universal Links / App Links so a marketing email can deep-link too.
- v1.3: iOS Siri Shortcuts + Android App Shortcuts that emit the same URLs (already documented in `VOICE_COMPANION.md` §2C).
- v1.4: Action receipts — when the user lands via a deep link, log a metadata-only `ContextSignal` so we can attribute conversions per Quick Action.
