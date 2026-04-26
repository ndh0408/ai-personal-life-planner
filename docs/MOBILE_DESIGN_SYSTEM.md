# LifeOS AI — Mobile Design System

The visual language is **"Editorial Calm"**: a warm, magazine-quiet surface
that makes a personal AI feel considered rather than corporate. It's how the
app earns trust on first launch.

## Palette

| Token | Hex | Usage |
|---|---|---|
| `bg.canvas` | `#0B0B0F` | App background (dark mode default) |
| `bg.surface` | `#15151B` | Cards, sheets, modals |
| `bg.surfaceAlt` | `#1F1F27` | Pressed / elevated card |
| `text.primary` | `#F4EFE7` | Body and headings |
| `text.secondary` | `#9C968B` | Subtitles, hints |
| `text.muted` | `#6B6760` | Disabled, timestamps |
| `accent.primary` | `#C97B4A` | Sienna — CTAs, focus, kickers |
| `accent.primaryHover` | `#B86A3C` | Pressed state of accent |
| `accent.success` | `#7FA66B` | Confirmed save |
| `accent.warning` | `#D6A24E` | Mild alert |
| `accent.danger` | `#C9624A` | Destructive only |
| `border.subtle` | `#252530` | Card border, divider |
| `cream` | `#F4EFE7` | Light-mode canvas (phase 2) |

Single accent rule: only **one** colour outside the neutral ramp may appear in
a given screen state. No three-colour gradients. No neon.

## Type

Two families:

- **Display / kicker**: *Fraunces* — variable serif, used for screen titles,
  numeric stats, kickers (uppercase, letter-spacing 2).
- **Body / UI**: *Plus Jakarta Sans* — geometric humanist sans, used for body,
  buttons, labels.

Type scale (modular ratio 1.25, base 16):

| Token | Size / Line | Family / Weight |
|---|---|---|
| `display.xl` | 40 / 46 | Fraunces 600 |
| `display.lg` | 32 / 38 | Fraunces 600 |
| `title` | 24 / 30 | Fraunces 500 |
| `kicker` | 13 / 16 (LS 2, UPPER) | Plus Jakarta 600 |
| `body` | 16 / 24 | Plus Jakarta 400 |
| `bodyEm` | 16 / 24 | Plus Jakarta 600 |
| `caption` | 13 / 18 | Plus Jakarta 500 |
| `mono` | 14 / 20 | JetBrains Mono (debug only) |

## Spacing & layout

- Grid: 8 pt. All spacing is a multiple of 4 (rare) / 8 (default).
- Vertical rhythm: 8, 12, 16, 24, 32, 48.
- Card radius: 16 pt. Sheet radius: 24 pt at the top corners.
- Shadow: only for true elevation (modals); never for cards on the canvas.
  Use border `border.subtle` instead of dropshadow.
- Safe area: respected on top + bottom; horizontal padding 24.

## Components (round 1 — landed)

The 18 primitives under `apps/mobile/src/components/ui/` form the design
system. Higher-level composites (Quick Capture bar, mood picker, expense
row, …) live under `components/<feature>/` and are added as features ship.

| Component | Purpose |
|---|---|
| `AppScreen` | Safe-area + scroll + keyboard-avoid wrapper. Default 24 px horizontal padding; `edgeToEdge` flag for full-bleed. |
| `AppHeader` | Kicker + title + optional back button + trailing slot. |
| `Card` | Surface (`bg.surface`, 1 px border, radius 16). Optional press state. `emphasis="elevated"` swaps to `surfaceAlt`. |
| `Button` | `primary` (sienna), `secondary`, `ghost`, `danger`. Sizes `md` / `lg`. Loading + disabled states. |
| `TextField` | Label + uppercase kicker, optional secret toggle, optional error/hint. |
| `MoneyInput` | Integer-in-smallest-unit; renders a Vietnamese-grouped display, strips non-digits on input. |
| `Chip` | Selectable pill, `neutral` / `accent` tones. |
| `Badge` | Small uppercase tag, status tones (success/warning/danger/info). |
| `EmptyState` | Title + body + optional action — sentence-first, never an illustration. |
| `ErrorState` | Title + body + retry. Falls back to i18n `common.errorTitle/Body`. |
| `LoadingState` | Spinner + label, inline or block. |
| `SkeletonCard` | Shimmering placeholder matching the eventual card shape. |
| `ConfirmModal` | Two-button modal with destructive variant. |
| `BottomSheet` | Animated sheet with scrim; default 60 % height. |
| `ToastProvider` / `useToast` | Top-mounted, auto-dismiss 3 s; success / warning / danger / info. |
| `QuickActionButton` | Icon-led row with label + hint. |
| `InsightCard` | Border-left tone bar + title + body, optional press, optional badge. |
| `StatCard` | Kicker label + monospaced number + delta arrow. |
| `Text` | Polymorphic typography wrapper (`display` / `title` / `body` / `kicker` / `link` / …). |

All primitives consume tokens from `apps/mobile/src/theme/`:
`colors`, `spacing`, `radius`, `typography`, `shadows`. Never hard-code a
hex / px / weight in a screen — extend the token if it's missing.

## Motion

- Entry: 240 ms ease-out (`cubic-bezier(.2,.8,.2,1)`).
- Exit: 160 ms ease-in (`cubic-bezier(.4,0,1,1)`).
- Press feedback: 80 ms scale to 0.98 + opacity 0.9.
- No bounce, no spring overshoot in chrome.
- Sheet: 320 ms spring (low stiffness) is allowed because it telegraphs gesture.

## Iconography

- React Native Vector Icons → Lucide set, 1.5 px stroke, 24 pt default.
- No emoji as the only label. Emoji only as a *prefix* with text.
- App icon and adaptive icon: stylised "L" with a small sienna dot mark.

## Accessibility

- Body text minimum 16; never below.
- Hit targets: 44×44 minimum.
- Colour contrast: text on `bg.canvas` ≥ 7:1 for body, ≥ 4.5:1 for caption.
- All actionable elements have `accessibilityLabel` and `accessibilityRole`.
- Reduced-motion: when the OS flag is on, motion durations halve and the sheet
  spring becomes ease-out.
- VoiceOver: Quick Capture is the first focusable element on Home.

## Copy voice

- Vietnamese first, English mirrored. Tone: warm, brief, never cute.
- Use **"bạn"**, never **"quý khách"**.
- Avoid exclamation marks in success copy. The animation is the celebration.
- Errors describe the next action: *"Thử lại"* not *"Lỗi"*.
