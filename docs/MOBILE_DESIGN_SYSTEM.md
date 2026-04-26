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

## Components (round 1+ inventory)

These are the components the mobile app will own. Foundation round implements
none of them yet — they're listed so designers and engineers stay aligned.

- `<Screen>` — top-level container with safe area + scroll behaviour.
- `<Kicker>`, `<Title>`, `<Body>` — typography wrappers.
- `<Card>` — surface, radius 16, optional border, optional press state.
- `<QuickCaptureBar>` — sticky bottom input with mic; the core of the app.
- `<PreviewChip>` — what comes back after `/capture/parse`; tap to confirm,
  swipe to discard.
- `<CategoryPill>` — chip selector (used in confirm screens).
- `<EmptyState>` — sentence + single action.
- `<Skeleton>` — shimmer matching the final layout.
- `<Toast>` — top, auto-dismiss 3 s; success / warning / danger only.
- `<Sheet>` — bottom sheet; default 60% height, swipe-down to dismiss.
- `<NumberStepper>` — for amounts (replaces typing where possible).
- `<MoodPicker>`, `<SleepDial>`, `<TimeChips>` — input replacements.

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
