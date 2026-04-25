# Home-Screen Widgets — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/widgets/*`, `apps/mobile/src/services/widgets/*`, `apps/mobile/src/screens/widgets/WidgetSettingsScreen.tsx`, schema Section P.
**Companion to:** [WIDGET_PRIVACY.md](./WIDGET_PRIVACY.md), [DEEP_LINKS.md](./DEEP_LINKS.md).

## 1. What ships in v1.2

The full **data + permissions + settings + preview** plumbing for 4 widget types is shipped:

| Widget | Backend signal source | Quick Actions |
|--------|----------------------|----------------|
| Today Smart | greeting + pendingTasks + nextTask + nextScheduleItem + meals | open Today, complete next task, check-in, ask AI |
| AI Nudge | topRecommendation (priority sort, NEW/VIEWED) | View, Dismiss, Ask AI |
| Quick Capture | n/a (action grid) | Add Task, Add Expense, Add Meal, Mood, Sleep, Voice |
| Finance | totalIncome / totalExpense / remaining / budget warnings / savings % | Add Expense, Add Income, Open Finance |
| Health | sleepMinutes / mood / energy | Sleep check-in, Mood check-in, Open Health |

What is **not** in v1.2:
- The native iOS `WidgetKit` extension and the native Android `AppWidgetProvider` binaries. v1.2 ships ONLY the data layer + the on-device snapshot store + the in-app preview UI. Native widgets land in v1.3 once we run `expo prebuild` (see §3).

This split is deliberate: the JS-side contract is stable today, so the v1.3 native add-on is a drop-in.

## 2. Architecture

```
┌─────────────────────────┐  HTTPS  ┌──────────────────────────────┐
│ Mobile (Expo / RN)      │ ──────► │ NestJS API                   │
│                         │         │                              │
│  WidgetSettingsScreen   │         │ GET  /api/widgets/summary    │
│   ├─ pulls /summary     │         │ GET  /api/widgets/preferences│
│   ├─ writes snapshot    │         │ PUT  /api/widgets/preferences│
│   └─ live preview cards │         │                              │
│                         │         │ WidgetSummaryService.build() │
│  widgetSnapshotStore    │         │  ├─ reads PrivacySettings    │
│   ├─ AsyncStorage,      │         │  ├─ shapes payload per       │
│   │   namespaced per    │         │  │   showFinanceAmounts +    │
│   │   userId            │         │  │   privacyMode             │
│   ├─ logout → clear()   │         │  └─ never includes amounts   │
│   └─ snapshot version 1 │         │      when not opted in       │
└─────────────────────────┘         └──────────────────────────────┘
              │                                       │
              │  v1.3 native widget reads             │
              │  the same snapshot file via           │
              │  iOS App Group / Android FileProvider │
              ▼                                       │
┌─────────────────────────────────────────────────────┘
│ NATIVE WIDGET (v1.3)
│  iOS WidgetKit extension OR Android AppWidgetProvider.
│  Renders 4 widgets from the snapshot. Tapping a Quick Action
│  fires `lifeos://...` which the React Navigation `linking`
│  config maps to the matching Stack.Screen.
└──────────────────────────────────────────────────────
```

## 3. v1.3 native setup (recommended path)

Expo managed workflow does **not** support native widget extensions. The recommended approach when v1.3 ships:

1. **`expo prebuild`** to materialise `ios/` and `android/` folders in the repo. This is reversible — Expo config plugins can re-run prebuild on every CI build.
2. **iOS:**
   - Add a `WidgetExtension` target via Xcode.
   - Share an **App Group** (`group.com.<yourorg>.lifeosai`) between the main app and the widget extension.
   - Main app writes the snapshot file via [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/) into the App Group's shared container; the widget reads from the same container.
   - Use `WidgetKit` in Swift to render Today / Nudge / Quick Capture / Finance / Health widgets.
   - Wire `widgetURL("lifeos://...")` on each widget's tap target.
3. **Android:**
   - Add `AppWidgetProvider` Java/Kotlin class + XML providers in `android/app/src/main/res/xml/`.
   - Use `androidx.glance` (preferred) or classic `RemoteViews`.
   - Main app writes the snapshot into a `FileProvider`-shared file; widget reads via `ContentResolver`.
   - Wire `PendingIntent` with `Intent(ACTION_VIEW, Uri.parse("lifeos://..."))`.
4. **Config plugin:** wrap the iOS / Android boilerplate in an Expo config plugin so the next `expo prebuild` is reproducible.
5. **EAS build:** the `production` profile in `eas.json` already builds AABs/IPAs — verify the new targets are included after `prebuild`.

Alternative: drop to bare React Native if the plugin maintenance becomes a burden. Today's data layer is unchanged either way.

## 4. Snapshot lifecycle

- Mobile fetches `GET /api/widgets/summary` on:
  - app foreground (TanStack Query default)
  - manual refresh button on `WidgetSettingsScreen`
  - any successful preferences PUT (cache invalidation)
- Snapshot is written to AsyncStorage at key `lifeos.widget.snapshot.<v>.<userId>`. Native widgets in v1.3 will read the same data via App Group / FileProvider.
- On **logout**, `widgetSnapshotStore.clear()` wipes EVERY namespaced key. Defends against cross-user leak when multiple accounts use the same device.
- On widget master switch OFF, the snapshot is also cleared and the API responds with an empty-shaped doc on the next call.

## 5. Backend contract

`GET /api/widgets/summary` returns `WidgetSummaryDto` (see `packages/shared/src/schemas/widgets.schema.ts`). Important shape rules:

- `finance.amounts` is **absent** unless `showFinanceAmounts=true` AND `privacyMode='FULL'`.
- `health` is absent if `showHealthData=false` OR `privacyMode='MINIMAL'` OR the privacy `health` AI gate is OFF.
- `topRecommendation` is absent if `showRecommendations=false` OR `privacyMode='MINIMAL'`.
- `nextTask.title` is truncated to 80 chars.
- `topRecommendation.content` is truncated to 200 chars.
- Field-level absence (not zeroed values) is the design — the widget cannot render data the JSON doesn't carry.

Throttle: 60/min per user (the widget pulls only on app foreground, not on a native timer).

## 6. Tests

`apps/api/src/modules/widgets/widget-summary.service.spec.ts` covers:

- master switch OFF returns empty doc.
- finance amounts hidden by default (no `amounts` field).
- finance amounts shown only when `showFinanceAmounts=true` AND `privacyMode='FULL'`.
- finance entire section dropped when finance privacy gate OFF.
- privacyMode `MINIMAL` drops health + recommendation.

## 7. Manual test plan

### In-app preview

1. Sign in. Settings → Home-screen widgets → preview cards render with the user's actual data.
2. Toggle "Show exact amounts" OFF → finance preview shows `Amounts hidden` badge + percent only.
3. Switch privacyMode to `MINIMAL` → health card shows `Health widget hidden by your settings.`, AI nudge card shows `No nudges right now.`.
4. Tap Refresh → snapshot updates with a new `widgetUpdatedAt`.
5. Sign out, sign in as a different user → preview shows the new user's data; old snapshot was wiped (open AsyncStorage debugger to confirm).

### Deep links (no native widget required)

- iOS Simulator: `xcrun simctl openurl booted lifeos://tasks/add` → app opens to CreateTask screen.
- Android emulator: `adb shell am start -a android.intent.action.VIEW -d "lifeos://finance/add-expense"` → AddExpense screen.
- Repeat for every URL in `KNOWN_DEEP_LINKS` (see `services/widgets/deep-link.ts` + `docs/DEEP_LINKS.md`).

### Native widget (v1.3)

After `expo prebuild` + EAS build:
- iOS: long-press home, Add Widget, find LifeOS AI, pick a size, confirm data renders.
- Android: long-press home, Widgets, find LifeOS AI, drop on screen.
- Verify Quick Actions deep-link into the right Stack.Screen.
- Sign out → widget renders an "empty / signed out" placeholder (the snapshot was wiped).
