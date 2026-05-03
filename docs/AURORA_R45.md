# Aurora — Round 45 Design System

> Status: shipped. Live in app v0.4.5 (commit `d4904d2`+).
> Source: Pencil .pen file → 7 PNG exports under [`docs/aurora-figma/`](./aurora-figma/).

## Identity

A *living* mesh-gradient canvas in **muted midnight indigo** with one
restrained accent — **champagne pearl** `#E8D5B2` — carrying every
active state across the entire app. Lemniscate ∞ logo + serif headlines
+ Inter body + JetBrains Mono numerics.

Design intent: premium, restrained, sophisticated. No rainbow per-moment
palette. No coral / teal / hot-violet. Three muted accents only:

| Token            | Hex       | Role                                          |
|------------------|-----------|-----------------------------------------------|
| `accent`         | `#E8D5B2` | Active states (tab, FAB, button, chip, ring) |
| `accentGlow`     | `#B5A8E0` | Ambient highlights (lemniscate, serif glow)  |
| `kind.income`    | `#8FB3A3` | Sage — income, vitality                       |
| `kind.expense`   | `#C49AAB` | Muted rose — expense, danger                  |
| `kind.task`      | `#7B9DB8` | Dusty blue — task                             |
| `kind.mood`      | `#D4B068` | Champagne gold — mood                         |
| `kind.sleep`     | `#B5A8E0` | Lavender — sleep                              |
| `inkPrimary`     | `#F5F1E8` | Warm-white text                               |
| `inkSecondary`   | `#D5CFC0` | Bone secondary                                |
| `inkTertiary`    | `#8D88A6` | Muted indigo tertiary                         |

Five hour-of-day moments (`night/dawn/noon/afternoon/dusk`) all stay in
the same indigo–violet family — the canvas drift is for *atmosphere*,
not chromatic identity.

## Tokens

Source of truth: [`packages/aurora/src/`](../packages/aurora/src/).

- `palette.ts` — moments + status + kind hues
- `space.ts`, `radius`, `motion`, `typography` — sizing/spacing/animation
- `index.ts` — barrel export

Mobile consumes via `@lifeos/aurora` (workspace symlink) + reads through
`useAurora()` hook → never reaches into raw hex.

## Components (apps/mobile/src/aurora/)

| File                       | Role                                                      |
|----------------------------|-----------------------------------------------------------|
| `AuroraProvider.tsx`       | Context provider; refreshes moment every 5 min            |
| `AuroraCanvas.tsx`         | Living mesh-gradient bg, 16s drift, 6% scale              |
| `AuroraScreen.tsx`         | Canvas + safe-area wrapper + scroll                       |
| `AuroraHeader.tsx` (R45)   | Lemniscate ∞ + serif brand + glass icon button            |
| `GlassSurface.tsx`         | Frosted glass card with optional glow                     |
| `FlowText.tsx`             | Typo primitive — variant + tone → palette color           |
| `BreathingDot.tsx`         | Pulsing indicator                                         |
| `GradientButton.tsx`       | CTA — gradient / glass / ghost variants                   |
| `OrbDial.tsx`              | Score display 0–100, animated SVG arc                     |
| `AuroraSparkline.tsx`      | 7-day sparkline                                           |
| `CaptureSheet.tsx` (R45)   | Aurora capture bottom sheet (Pencil layout)              |
| `SettingsSheet.tsx`        | Profile + 5-row settings (Pencil layout)                  |

Tab bar lives at
[`apps/mobile/src/navigation/aurora/AuroraTabBar.tsx`](../apps/mobile/src/navigation/aurora/AuroraTabBar.tsx)
— floating pill with icon+label tabs (Ionicons) + capture FAB.

## Screens

All wired to real data via existing hooks (`useDashboardSummary`,
`useTodayTasks`, `useLatestSleep`, `useLatestMood`, `useTodayPlan`,
`journalService.listMood('week')`, etc.). Empty states show informative
copy ("Chưa ghi giấc", "Chưa đủ dữ liệu") rather than fake placeholders.

| Screen   | Pencil PNG                              | Data source                                                              |
|----------|------------------------------------------|--------------------------------------------------------------------------|
| Today    | [01-today.png](./aurora-figma/01-today.png)       | `useDashboardSummary`, `useTodayTasks`, `useAiKeyStatus`                |
| Plan     | [02-plan.png](./aurora-figma/02-plan.png)         | `useTodayPlan`, `useGenerateTodayPlan`, `useSetItemStatus`              |
| Money    | [03-money.png](./aurora-figma/03-money.png)       | `useDashboardSummary` (money block) + `financeService.list('today')`    |
| Health   | [04-health.png](./aurora-figma/04-health.png)     | `useLatestSleep`, `useLatestMood`, `useTodayTasks`, `listSleep('week')` |
| Mind     | [05-mind.png](./aurora-figma/05-mind.png)         | `useLatestMood`, `journalService.listMood('week')`                       |
| Capture  | [06-capture.png](./aurora-figma/06-capture.png)   | Capture context → `/capture/parse` → `/capture/confirm`                 |
| Settings | [07-settings.png](./aurora-figma/07-settings.png) | `useAuthStore`, `useAiKeyStatus`                                         |

## Derived Scores (no hardcode)

`HealthAurora`:
- **Recovery** = sleep hours mapped to 0–95 + quality bonus/penalty
- **Vitality** = latest mood mapped to 0–95 + energy bonus/penalty
- **Rhythm** = `done / total` of today's tasks × 100

`TodayAurora`:
- **Energy** = base 60 + sleep duration tiers + sleep quality bonus

`MindAurora`:
- **7-day mood chart** = `/mood-logs?range=week` rows grouped by
  day-of-week, averaged within day. Missing days render as muted bars.
- **AI insight** = peak/low day analysis, gated by ≥3 days of data.

## Removed (cleanup, R45)

- `apps/mobile/src/components/v2/CaptureSheetV2.tsx`
- `apps/mobile/src/components/v2/KindChipRow.tsx`

The legacy v2 nav stack (`navigation/v2/MainTabsV2.tsx`,
`screens/v2/*ScreenV2.tsx`) is unreachable from `RootNavigator` and can
be removed in R46 if no migration path needs it.

## Build / Ship

- Android: `cd apps/mobile/android && ./gradlew assembleRelease` →
  `app-release.apk` (~63 MB) → upload via
  `gh release upload latest <apk> --clobber` as `lifeos-r45-muted-aurora.apk`.
- iOS: `xcodebuild -workspace LifeOS.xcworkspace -scheme LifeOS …`
  on `mac-build` → unsigned IPA → upload as `LifeOS-r45-muted-aurora.ipa`.
- Auto-sign daemon on `huy-server` polls GH Releases every 60s and
  re-signs the IPA via AltServer-Linux + anisette so the iPhone can
  Sideloadly the latest build.
