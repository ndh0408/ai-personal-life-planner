# LifeOS AI — brand assets

This document is the canonical reference for the LifeOS AI visual identity:
the brand concept, the color palette, every shipped asset, and the rules for
where each asset is allowed to appear.

All artwork is generated programmatically. The single source of truth is
[`scripts/generate-mobile-assets.py`](../scripts/generate-mobile-assets.py).
There are no manually-edited PNGs in the repo.

---

## Brand concept

**LifeOS AI** is a personal life operating system — a 24/7 AI companion that
helps a person plan their schedule, build habits, manage their money, eat
better, sleep better, and pursue their goals. The visual identity has to feel:

- **Modern + premium**, but never cold or sterile.
- **AI-native** — there should be a sense of orbit, intelligence, motion.
- **Personal** — softness, warm glow, a sense that *you* are the center.
- **System / OS** — structure, balance, multiple life pillars in one place.

### The mark

The mark is a single composition with four meaningful parts:

1. **Central node** — a bright, soft white core. *You.*
2. **Orbit ring** — an indigo→cyan ring that wraps around the core.
   It’s the *operating system*: structure, time, the framework that holds
   your life together.
3. **Inner spiral** — a thinner broken arc inside the ring. The *AI* — a
   continuous presence, never a closed loop, always learning.
4. **Four pillar nodes** — small dots placed at N / E / S / W of the orbit:
   - **Cyan** (top) — schedule, today, time
   - **Green** (right) — finance, growth
   - **Indigo** (bottom) — goals, intent
   - **Light cyan** (left) — health, balance

   At small sizes (≤ 64 px) the favicon uses three larger nodes instead of
   four, because four small dots become indistinct.

### Voice

- Vietnamese-first, English equivalent always available.
- Short subtitles, no marketing fluff inside the icon itself.
- Default subtitle **vi**: “Trợ lý cá nhân thông minh”.
- Default tagline **en**: “Your personal life companion”.
- Long-form Vietnamese tagline (Play Store feature graphic): “Quản lý cuộc
  sống thông minh hơn mỗi ngày”.

---

## Color palette

The palette is intentionally narrow. Indigo + cyan carry the brand; green
and amber are accent only.

| Token            | Hex       | RGB             | Use                                      |
| ---------------- | --------- | --------------- | ---------------------------------------- |
| `indigo-900`     | `#0F172A` | 15, 23, 42      | Background dark, app shell base          |
| `indigo-800`     | `#1E1B4B` | 30, 27, 75      | Panel mid-stop                           |
| `indigo-700`     | `#312E81` | 49, 46, 129     | Panel deep accent                        |
| `indigo-600`     | `#4F46E5` | 79, 70, 229     | **Primary** — CTAs, brand, mark stroke   |
| `indigo-500`     | `#6366F1` | 99, 102, 241    | Primary lighter / pillar dot (goals)     |
| `cyan-500`       | `#06B6D4` | 6, 182, 212     | **Secondary** — orbit highlight, glow    |
| `cyan-400`       | `#22D3EE` | 34, 211, 238    | Pillar dot (today / schedule)            |
| `cyan-300`       | `#67E8F9` | 103, 232, 249   | Inner ring tint, pillar dot (health)     |
| `green-500`      | `#22C55E` | 34, 197, 94     | **Accent** — pillar dot (finance)        |
| `amber-500`      | `#F59E0B` | 245, 158, 11    | Warning accent only — never primary      |
| `slate-50`       | `#F8FAFC` | 248, 250, 252   | Background light                          |
| `slate-300`      | `#CBD5E1` | 203, 213, 225   | Subtitle text on dark                    |
| `slate-400`      | `#94A3B8` | 148, 163, 184   | Captions                                 |
| `white`          | `#FFFFFF` | 255, 255, 255   | Mark core, primary text on dark          |

Gradients used in shipped assets:

- **Panel gradient (vertical)**: `indigo-900` → `indigo-800` → `indigo-700`.
- **Feature graphic (diagonal 20°)**: `indigo-900` → `indigo-700` → `indigo-600`.
- **Glow halos (radial, additive feel via alpha)**: `cyan-500` over indigo,
  `indigo-500` over indigo.

---

## Asset list

All paths are relative to the repo root.

| Asset | Size | Format | Where it appears |
| ----- | ---- | ------ | ---------------- |
| [`apps/mobile/assets/icon.png`](../apps/mobile/assets/icon.png) | 1024×1024 | PNG (RGBA, opaque panel) | Expo `icon` → iOS app icon master |
| [`apps/mobile/assets/adaptive-icon.png`](../apps/mobile/assets/adaptive-icon.png) | 1024×1024 | PNG (RGBA, transparent) | Android `adaptiveIcon.foregroundImage` |
| [`apps/mobile/assets/splash.png`](../apps/mobile/assets/splash.png) | 1290×2796 | PNG (RGB) | Expo splash, `resizeMode: contain` |
| [`apps/mobile/assets/favicon.png`](../apps/mobile/assets/favicon.png) | 64×64 | PNG (RGBA) | Expo `web.favicon` |
| [`apps/mobile/assets/brand-mark.png`](../apps/mobile/assets/brand-mark.png) | 1024×1024 | PNG (RGBA, transparent) | Marketing decks, social, email signature |
| [`apps/mobile/assets/wordmark.png`](../apps/mobile/assets/wordmark.png) | 1600×500 | PNG (RGBA, transparent) | Headers, store listing, press kit |
| [`apps/mobile/assets/store-icon.png`](../apps/mobile/assets/store-icon.png) | 1024×1024 | PNG (RGBA, opaque panel) | App Store / Play Store square master |
| [`apps/mobile/assets/feature-graphic.png`](../apps/mobile/assets/feature-graphic.png) | 1024×500 | PNG (RGB) | Play Store feature graphic |
| [`apps/mobile/assets/og-image.png`](../apps/mobile/assets/og-image.png) | 1200×630 | PNG (RGB) | Open Graph / Twitter / web sharing |

---

## Regeneration

```bash
# from repo root
python3 scripts/generate-mobile-assets.py
```

Requirements:

- Python ≥ 3.10
- Pillow ≥ 9 (`pip install Pillow`)
- Optional but recommended: Lato installed at the standard Debian path
  (`/usr/share/fonts/truetype/lato/Lato-*.ttf`). On Debian/Ubuntu:
  `sudo apt install fonts-lato`.

The script:

- discovers fonts at runtime — falls back to Pillow's bundled bitmap default
  if Lato is missing,
- supersamples mark detail (3×) then downsamples with LANCZOS for crisp AA,
- builds gradients on a small canvas then upscales with LANCZOS for
  performance,
- verifies every output PNG matches its expected dimensions and fails loudly
  if it doesn't.

Total runtime: ~30 s on a modern laptop.

### After regenerating

1. Commit the regenerated PNGs alongside any script change.
2. For mobile launch surface changes (`icon.png`, `adaptive-icon.png`,
   `splash.png`), **rebuild the native app**. Expo Go won’t pick up a new
   launch icon or splash without a fresh dev or production build:
   ```bash
   cd apps/mobile
   npm run prebuild
   npm run build:ios       # or build:android — requires EAS
   ```

---

## Where each asset is allowed to appear

### Mobile app

`apps/mobile/app.config.ts` references four assets and they MUST stay in
sync with the table above:

| Config key                                      | Asset                  |
| ----------------------------------------------- | ---------------------- |
| `icon`                                          | `icon.png`             |
| `splash.image`                                  | `splash.png`           |
| `android.adaptiveIcon.foregroundImage`          | `adaptive-icon.png`    |
| `android.adaptiveIcon.backgroundColor`          | `#0B0B0F` (dark)       |
| `splash.backgroundColor`                        | `#0B0B0F` (dark)       |
| `web.favicon`                                   | `favicon.png`          |

If you rename or remove any of these PNGs, update `app.config.ts` in the
same commit.

### App Store (iOS)

- **App icon**: upload `store-icon.png`. Apple's renderer applies the rounded
  corner mask automatically — do **not** pre-mask.
- **Marketing copy / screenshots**: use `brand-mark.png` and `wordmark.png`
  as needed.
- iOS App Store requires opaque PNGs with no alpha for the icon — `store-icon.png`
  is rendered with a fully opaque panel. Re-export to JPEG only if Apple's
  current uploader rejects PNG.

### Play Store (Android)

- **App icon**: upload `store-icon.png`.
- **Feature graphic** (1024×500): upload `feature-graphic.png`.
- The adaptive icon already shipped inside the APK/AAB is what users see on
  device — `feature-graphic.png` is for the listing only.

### Web / social

- **Open Graph + Twitter card**: `og-image.png` (1200×630).
- **Favicon**: `favicon.png` (64×64).
- **Email signatures / decks**: `wordmark.png` (transparent — works on light
  or dark backgrounds; the wordmark text is dark indigo so prefer light bg).

---

## Don'ts

- ❌ Do not bake third-party platform logos (Apple, Google, OpenAI, NVIDIA,
  Anthropic, Microsoft) into any asset. Mention them in copy if needed,
  never in the visual mark.
- ❌ Do not use stock photography. The brand is illustrative + abstract.
- ❌ Do not edit a PNG by hand — always change the script and regenerate so
  the next person can reproduce your work.
- ❌ Do not bundle font files into the repo without a clear license. The
  generator only loads system-installed fonts.
- ❌ Do not crop the adaptive icon tighter than 60 % — Android masks vary by
  OEM and we need the safety margin.
