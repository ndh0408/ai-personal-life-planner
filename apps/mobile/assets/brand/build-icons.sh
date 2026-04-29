#!/usr/bin/env bash
# Render the brand SVG to every Android launcher density (round 33).
#
# Re-run whenever icon-source.svg / icon-foreground.svg changes. The
# output PNGs go into apps/mobile/android/app/src/main/res/mipmap-*.
#
# Densities + target sizes (px):
#   mdpi    48x48      (1x)
#   hdpi    72x72      (1.5x)
#   xhdpi   96x96      (2x)
#   xxhdpi  144x144    (3x)
#   xxxhdpi 192x192    (4x)
#
# Adaptive-icon foreground drawable goes to res/drawable as a vector +
# a pre-rasterised xxxhdpi fallback.
#
# Requires: rsvg-convert (libRSVG) on PATH. Optipng optional for smaller files.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_DIR="$ROOT/assets/brand"
OUT_DIR="$ROOT/android/app/src/main/res"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "✗ rsvg-convert not on PATH. apt install librsvg2-bin"
  exit 1
fi

declare -A SIZES=(
  [mdpi]=48
  [hdpi]=72
  [xhdpi]=96
  [xxhdpi]=144
  [xxxhdpi]=192
)

for density in "${!SIZES[@]}"; do
  size="${SIZES[$density]}"
  dir="$OUT_DIR/mipmap-$density"
  mkdir -p "$dir"
  echo "▸ $density (${size}x${size})"
  # ic_launcher.png — full bleed (cream + mark).
  rsvg-convert -w "$size" -h "$size" \
    "$SRC_DIR/icon-source.svg" -o "$dir/ic_launcher.png"
  # ic_launcher_round.png — same source; the launcher mask shapes it.
  cp "$dir/ic_launcher.png" "$dir/ic_launcher_round.png"
done

# Adaptive-icon foreground PNG fallback (xxxhdpi only — the XML below
# references the vector; this is for older runtimes that ignore the XML).
rsvg-convert -w 432 -h 432 \
  "$SRC_DIR/icon-foreground.svg" -o "$OUT_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png"

# Splash logo at xxxhdpi for the @drawable/splash_logo reference.
mkdir -p "$OUT_DIR/drawable-xxxhdpi"
rsvg-convert -w 480 -h 480 \
  "$SRC_DIR/splash-logo.svg" -o "$OUT_DIR/drawable-xxxhdpi/splash_logo.png"

echo "✓ launcher + splash icons regenerated"
