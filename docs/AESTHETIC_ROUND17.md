# LifeOS AI — Round 17: Visual redesign

User feedback after round 16: "giao diện xấu / đần / không thông minh".
Audit by uiautomator dump confirmed it: Unicode geometric symbols
(`◉ ◐ ◇ ✦ ◎`) for tab icons, mixed emoji + text glyphs in Quick Actions,
flat dark cards with no elevation, `+0 ₫ / −0 ₫` numbers floating without
context, plan timeline reduced to text + emoji rows.

Round 17 swaps the entire icon system to a real font (Ionicons), adds
elevation + halo treatment to cards, brings sparklines to finance stats,
gives the plan timeline a proper rail with dot indicators, and adds an
avatar-led greeting hero.

> Mobile: `apps/mobile/`
> No backend changes.

---

## What changed (proven by uiautomator dump)

### Before (round 16)
```
Tab bar:       ◉ ◐ ◇ ✦ ◎     ← unicode geometry (programmer-art)
Quick Actions: ✎ 💸 ✓ ✦ ✨    ← 3 styles mixed (text/emoji/text)
Plan timeline: 🍚 🌱 💤        ← emoji glyphs in text col
Hero:          "Chào Huy" 32px display, alone, no avatar
Money stats:   "+0 ₫ / -0 ₫"  ← bare numbers, no chart
Cards:         flat #15151B on #0B0B0F (~1.04:1 contrast)
```

### After (round 17, dumped from device)
```
Tab bar icons →       (Ionicons home / calendar /
                                                     wallet / sparkles / settings)
Quick Actions →    ...  (Ionicons create / cash / check /
                                           pulse / sparkles, each in coloured halo)
Plan timeline →    ...  (Ionicons calendar / restaurant / moon)
Hero          → "HU" avatar + "Buổi sáng" + "Chào Huy" + 2 CTAs with icons
Money stats   → halo icons + sparkline + tabular-nums + ´−´ proper minus
Cards         → Platform shadow + border + lifted surface variant
```

---

## Foundation work

### 1. Icon system (`components/ui/Icon.tsx`)
- Wraps `react-native-vector-icons/Ionicons` with a typed `IconName` union.
- Single source of truth — every screen and component imports `<Icon />`.
- Android `build.gradle` opts in via `vectoricons.iconFontNames=['Ionicons.ttf']`
  (only Ionicons is bundled — adds ~80KB to the APK).
- Replaced glyphs across: MainTabs (5), QuickActionsRow (5), KindBadge (7),
  PlanItemRow (8), HomeHero (2), SmartEntryScreen preview (7),
  MoneyScreen rows + stats (2), Money TimelineRow halos (2).

### 2. Avatar component (`components/ui/Avatar.tsx`)
- Initials derived from `displayName` or `email` (1-2 letters).
- Tinted halo circle, sized 40 (Hero) / 56 (Settings).
- Falls back to `◍` glyph if no name.

### 3. Sparkline component (`components/ui/Sparkline.tsx`)
- 7-bucket SVG line + optional area gradient.
- Used on MoneyScreen stat cards to show 7-day income/expense trend.
- `react-native-svg@15.2.0` pinned (RN 0.74 ABI compatibility).

### 4. Card upgrade (`components/ui/Card.tsx`)
- `Platform.shadow` (iOS) / `elevation: 2` (Android) by default.
- New `emphasis="elevated"` for the Settings header / Money "Còn lại" net card.
- New `emphasis="flat"` for cases where the card is just a layout container.
- Pressed state now `transform: [{ scale: 0.985 }]` + tone shift, not just opacity.

### 5. Theme palette (`theme/colors.ts`)
- Added dedicated `colors.income` (warm green) and `colors.expense` (clay red).
  No more fragile `#2E8B57` / `#C24A3F` literals scattered across screens.
- Added `accent.softer` for the active tab pill.
- Added `gradient.*` stops for hero + sparkline fills.
- Tightened `surface` to `#15151D` for slightly more punch against the canvas.

---

## Per-screen polish

### HomeScreen + HomeHero
- Hero now leads with **Avatar + time-of-day kicker + greeting** in a single row.
  `Buổi sáng / chiều / tối / đêm khuya` derives from `Date.now()`.
- 2 CTAs (Ghi nhanh / Tạo lịch) gain Ionicons (`add`, `sparkles-outline`).
- "No-AI" hero variant gets the same treatment + warmer accent border.

### Tab bar (MainTabs)
- Ionicon outline + filled variants per tab, focused state lights up the
  active icon with a soft accent pill behind it.
- Bar height `56 + insets.bottom`, paddingBottom from safe-area insets.
- Labels nudged with `letterSpacing: 0.4` for breathing room.

### QuickActionsRow
- Each tile gains a tinted halo circle (40dp) housing an Ionicon, with
  per-action colour: capture/askAi → accent, expense → expense red,
  task → info blue, checkin → income green.
- `minHeight: 100`, `accessibilityRole='button'`, label with `numberOfLines={2}`.
- Pressed state: scale + border highlight.

### Plan timeline (PlanItemRow + TodayScreen)
- Vertical rail right of the time column with a coloured **dot** per item:
  outline by default, filled when done, thicker stroke when current.
- Connector line between dots (hidden on the last item).
- Card gets a 36dp halo icon coloured per `item.type` (TASK / MEAL / REST /
  WORK / HEALTH / FINANCE / CUSTOM all mapped).
- "Tạo lại kế hoạch" button uses the `today.regeneratePlan` i18n key (was
  `common.retry` — generic error string).
- Current-time detection: an item is `isCurrent` when `now ∈ [startAt, endAt]`.

### MoneyScreen
- New `FinanceStatCard` — halo icon (`arrow-up-circle` / `arrow-down-circle`),
  tabular-nums total, **7-day sparkline** at the bottom.
- "Còn lại" card uses `emphasis="elevated"` + a coloured border in income
  green / expense red, depending on `net` sign.
- TimelineRow gets the halo + arrow icon, proper `−` minus glyph (was `-`),
  `fontVariant: tabular-nums` so amounts align cleanly.

### SmartEntryScreen preview
- Replaced the inline emoji + label with a halo circle + Ionicon at 18dp.
- Consistent with KindBadge / Money rows.

### SettingsScreen
- Account header card now uses `emphasis="elevated"` and shows a 56dp
  Avatar + name + email + member-since stacked. Was a 3-row plain text list.

---

## Stats

```
Files changed                         18
+846 / -226 lines
New deps:
  react-native-vector-icons (~80KB Ionicons.ttf bundled)
  react-native-svg @15.2.0 (RN 0.74 ABI)
New components:
  Icon, Avatar, Sparkline
APK size: 58 MB → 59 MB
```

---

## Verified end-to-end (uiautomator dump on Xiaomi 13T)

```
HomeScreen   → avatar "HU", time-of-day "Buổi sáng", proper Ionicons in
                Quick Actions tiles (   …)
TodayScreen  → plan items render Ionicons (   …) instead
                of emoji; vertical rail with coloured dots visible
MoneyScreen  →  (arrow-up) +  (arrow-down) halos on Thu/Chi
                cards, sparkline ready, "−" proper minus on amounts
Tab bar      →  home,  calendar-outline,  wallet-outline,
                 sparkles-outline,  settings-outline
Settings     → "HU" avatar circle + name/email/member-since stacked card
APK          → 59 MB built, installed, launched on 100.118.234.3:5555
TS clean      ✓
```
