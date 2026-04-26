# Round 22 — "Editorial Calm" design system

**Date:** 2026-04-26
**Theme:** typography-led aesthetic refresh.

The Round 21 mobile app was functional, but it leaned on the same
indigo/violet SaaS palette and weight-based hierarchy that ships
default in every React Native starter. Round 22 commits to a clear
aesthetic direction — **"Editorial Calm"** — and rebuilds the type
system, palette, shadows, and primitive components around it.

The goal is for LifeOS AI to feel like a **leather-bound personal
journal designed by a Swiss studio**, not a dashboard. Specifically:

- Cream-paper backgrounds, ink-charcoal text.
- Burnt-sienna accent (replaces indigo).
- A serif display voice (Fraunces) paired with a refined sans body
  (Plus Jakarta Sans).
- Magazine kickers ("STEP 02 · BASICS", section eyebrows with rule
  lines) and italic accent on greetings + status chips.
- Hero cards with a thin sienna top rule, the way pull-quotes are
  set in print.

---

## What landed

### Typography stack
- New deps: `expo-font`, `@expo-google-fonts/fraunces`,
  `@expo-google-fonts/plus-jakarta-sans`.
- `App.tsx` loads both before the splash hides — no font flash.
- New `typography` token tree in `apps/mobile/src/theme/index.ts`:
  - `display` / `displayItalic` (Fraunces 36/42)
  - `h1` (Fraunces 26/32) / `h2` (21/27) / `h3` (17/23)
  - `body` (Plus Jakarta 15/22) / `bodyStrong`
  - `caption` / `small`
  - **`eyebrow`** — uppercase, tracked-out 1.6 letter-spacing
  - **`number` / `numberLarge`** — Fraunces with `tabular-nums`
  - **`italicAccent`** — Fraunces italic for greetings/status

### Palette (`apps/mobile/src/theme/colors.ts`)
- Primary: **burnt sienna** `#C45A2D` (light), `#D87650` (dark)
- BG: **cream paper** `#FAF6EE` (light), espresso charcoal (dark)
- Text: ink charcoal / taupe muted
- Surfaces: linen with warm linen border `#E0D5BC`
- Success: **sage moss** `#7A8B6B`
- Warning: **saffron** `#D4A04A`
- Danger: **bookbinder crimson** `#A8392E`
- Info: dusty azurite

### Shadows (`apps/mobile/src/theme/shadows.ts`)
- Switched from black to **warm ink** (`#3A2E1F`) so cards read as
  paper-on-paper rather than glass-on-cement.
- Slightly softer offsets / radii (level1 6px / level2 16px / level3
  28px).

### New / refreshed primitives

| Component | Round 22 changes |
|-----------|------------------|
| `Eyebrow` (new) | Small caps + tracked-out section header with optional bleed rule line. |
| `Card` | Warm border + new shadow tokens; optional `accent="top"` adds a sienna top rule. |
| `Chip` | Plus Jakarta Sans Semibold, hairline border, sub-pixel scale on press. |
| `Button` | Plus Jakarta Sans labels with letter-spacing; press scales 0.985. |
| `Badge` | New `variant="editorial"` — dot marker + tracked small-caps label. |

### Editorial passes on screens

| Screen | Editorial details |
|--------|-------------------|
| `DashboardScreen` | Italic-serif date row with rule line; status chip uses `variant="editorial"` (• SẴN SÀNG); display greeting with sienna italic name on its own line; section eyebrows + view-more uppercase links; hero card with sienna top rule. |
| `OnboardingWelcomeScreen` | Magazine kicker ("LifeOS AI · Tagline"); display headline + italic emphasis; language picker as left-rule selected cards with italic locale code. |
| `OnboardingBasicsScreen` | "STEP 02 · BASICS" kicker; serif h1 title; eyebrow-styled "main goal" label. |
| `OnboardingAISetupScreen` | "STEP 03 · ENABLE AI" kicker. |
| `AISetupScreen` (standalone) | "AI · BYOK" kicker. |
| `QuickCaptureScreen` | "CAPTURE · ONE LINE" kicker. |

### i18n
Added `dashboard.greeting.morningPlain` / `afternoonPlain` /
`eveningPlain` for the no-name editorial split greeting. Vi/en parity
preserved (`0` missing keys).

---

## Quality

```
npm run build:shared                         # passes
npm run --workspace apps/api typecheck       # passes
npx expo install --check                     # all deps OK
```

Mobile typecheck delta vs. master pre-round: **−6 non-JSX errors**.
The pre-existing TS2786/TS2607 baseline (RN component-as-JSX-element
issue affecting every screen project-wide) is unchanged.

## What this does NOT touch

- Component sweep is concentrated on the high-traffic screens
  (Dashboard, Onboarding, AI setup, Quick Capture). Other screens
  inherit the warm palette + new fonts automatically through theme
  tokens, but their layouts haven't been re-laid in editorial
  fashion (Today, Finance, Meals, Health, Tasks, etc.). Those land
  in subsequent rounds if needed.
- Dark theme is recoloured but not visually re-tested on real
  device.
- A "drop cap" (oversized first letter) on the hero greeting was
  considered but skipped because of RN text-baseline quirks.
