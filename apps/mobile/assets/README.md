# LifeOS AI — mobile branding assets

Production branding pack for the Expo / React Native app. Every PNG in this
folder is generated from a single source script — never edit the PNGs by hand.

## Files

| File                  | Size        | Used by                                                   |
| --------------------- | ----------- | --------------------------------------------------------- |
| `icon.png`            | 1024×1024   | Expo `icon` → iOS app icon                                |
| `adaptive-icon.png`   | 1024×1024   | Android adaptive foreground (`android.adaptiveIcon`)      |
| `splash.png`          | 1290×2796   | Expo splash (iPhone Pro Max class; scales for all phones) |
| `favicon.png`         | 64×64       | Web favicon                                               |
| `brand-mark.png`      | 1024×1024   | Transparent mark — marketing/social/decks                 |
| `wordmark.png`        | 1600×500    | Mark + “LifeOS AI” lockup — headers, decks, store listing |
| `store-icon.png`      | 1024×1024   | App Store / Play Store square master                      |
| `feature-graphic.png` | 1024×500    | Play Store feature graphic                                |
| `og-image.png`        | 1200×630    | Open Graph / Twitter / web sharing card                   |

## Regenerating

From the repo root:

```bash
python3 scripts/generate-mobile-assets.py
```

Requirements: Python 3.10+, Pillow ≥ 9. The script discovers system fonts
(prefers Lato — SIL Open Font License) and falls back to Pillow's bundled
default if no preferred font is found.

After regenerating you should always:

1. Commit the regenerated PNGs alongside any script change so reviewers see
   the visual delta.
2. For icon / splash / adaptive-icon changes, **rebuild the native app** — Expo
   Go won't pick up new launch assets without a new dev or production build:
   ```bash
   cd apps/mobile
   npm run prebuild           # regenerates ios/ + android/ native projects
   npm run build:ios          # or build:android (requires EAS)
   ```

## Safe-area / icon constraints

- **Adaptive icon (Android)**: Android crops the foreground inside a 66 %
  centered disc. The mark sits well inside the inner ~60 % of the canvas, so
  no detail is clipped under any system mask shape (circle, squircle,
  rounded square, teardrop). The transparent margin is intentional.
- **iOS app icon**: Apple's renderer applies a hard 22 % corner mask. Our
  `icon.png` panel keeps all detail inside a 12 % safe margin from each edge.
- **Favicon**: at 64 px the four orbital pillars become indistinct, so the
  favicon uses the simplified three-node variant of the mark.

## Brand guidelines

- All artwork is **original**, generated from vector primitives at runtime.
  No third-party logos (Apple, Google, OpenAI, NVIDIA, etc.) appear in any
  asset.
- No stock photography. No bundled font files — only system fonts
  (Lato — SIL OFL) loaded by path with a Pillow fallback.
- See [`docs/BRAND_ASSETS.md`](../../../docs/BRAND_ASSETS.md) for the full
  brand concept, color palette, and store-listing usage.
