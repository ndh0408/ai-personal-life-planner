# Widget Privacy — LifeOS AI

**Audience:** legal, security review, store reviewers, the user reading the lock-screen disclosure.
**Companion to:** [WIDGETS.md](./WIDGETS.md), [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [APP_STORE_PRIVACY_READINESS.md](./APP_STORE_PRIVACY_READINESS.md).

## 1. Plain-language summary

The home-screen widget cannot show data the user did not opt into showing. Privacy enforcement happens at the API SHAPE — when a toggle is off, the matching field isn't even in the JSON the snapshot stores. The native widget then physically cannot render it.

## 2. Three-layer privacy

```
PrivacySetting (app-wide)         WidgetPreferences (widget-only)         Privacy mode
─────────────────────────         ─────────────────────────────────       ────────────
useFinanceForAI=false   ──┐                                          ┌── FULL: render everything per the toggles
useHealthForAI=false    ──┤  AND   showFinance=false        ──┐  AND ┤── HIDE_SENSITIVE: amounts hidden, mood-only
useTasksForAI=false     ──┘        showHealthData=false     ──┘      └── MINIMAL: counts + next-task only
                                   showFinanceAmounts=false
                                   showRecommendations=false
                                   showTasks=false
```

The result is a single conservative `WidgetSummaryDto` document the widget can render verbatim with zero per-field client-side gates.

## 3. What the widget will NEVER show

- ❌ API keys (BYOK or otherwise) — never in the wire shape.
- ❌ OAuth tokens — never in the wire shape.
- ❌ Email body, message body, AI memory content — none of these are pulled by `WidgetSummaryService.build()`.
- ❌ Raw monetary amounts unless `showFinanceAmounts=true` AND `privacyMode='FULL'`.
- ❌ Mood / energy / sleep when `showHealthData=false` OR `privacyMode='MINIMAL'` OR the privacy `health` AI gate is OFF.
- ❌ Recommendation body when `privacyMode='MINIMAL'`.

## 4. Defaults are conservative

| Setting | Default | Rationale |
|---------|---------|-----------|
| `enabled` | true | The widget itself is fine; specific data toggles guard sensitive content. |
| `showFinanceAmounts` | **false** | Lock-screen exposure of money is the highest-risk surface. User must explicitly opt in. |
| `privacyMode` | `HIDE_SENSITIVE` | Even if user toggles `showFinance` on without thinking, the widget shows percent / dashes. |
| `showHealthData` | true | Mood/energy is opt-in upstream via `useHealthForAI`; if that's on, surfacing it on the widget is fine. |
| `showTasks` | true | Task title shown; backend truncates to 80 chars. |
| `showRecommendations` | true | Type + title + 200-char content max. |

## 5. Cross-user defence

The snapshot file is namespaced as `lifeos.widget.snapshot.<v>.<userId>`. The native widget extension (v1.3) will read the file path keyed by the currently-signed-in user id only. On logout, `widgetSnapshotStore.clear()` wipes EVERY namespaced key. Result: signing in as a different user on the same device cannot leak the previous user's preview into the new user's widget.

## 6. Lock-screen behaviour

iOS lock-screen widgets render the same data as home-screen widgets. The conservative defaults (no amounts, mood-collapsed, MINIMAL fallback) make a lock-screen LifeOS widget safe by default. Users who want richer data can opt into FULL privacyMode and explicit amount display via WidgetSettingsScreen — the consent path is always inside the app, never inside the widget.

## 7. Logging policy

Backend `WidgetsController` and `WidgetSummaryService` log NOTHING widget-payload-related. The Nest logger sees method/URL/status only. The widget snapshot file is not synced to the server; it lives only on the user's device.

## 8. App-store disclosures

When v1.3 ships native widgets:
- **Apple App Privacy** — under "Data Used to Display in Widgets": Identifiers + App Functionality only. Never Tracking. The Widget Family declaration in the WidgetExtension Info.plist must list the supported sizes.
- **Google Play Data Safety** — App Widgets are not separately disclosed; the underlying data categories already declared (financial info, health & fitness, app activity) cover the widget surface.

## 9. Roadmap

- v1.3: native iOS WidgetKit + Android `AppWidgetProvider` binaries reading the same snapshot file.
- v1.3: optional refresh-via-OS-cron (iOS Timeline Provider 30-minute reload; Android `AppWidgetManager.updatePeriodMillis` ≥30min) — both with the conservative defaults the JS layer already enforces.
- v1.4: Per-widget-family privacy mode (allow lock-screen widget to be MINIMAL while the home-screen widget is FULL).
