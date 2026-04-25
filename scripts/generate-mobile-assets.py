#!/usr/bin/env python3
"""
Generate the LifeOS AI mobile + store branding assets.

Pure-Python (Pillow only) renderer that emits every PNG referenced by
`apps/mobile/app.config.ts` plus the marketing/store collateral. Run from
anywhere; paths resolve from the repo root.

    python3 scripts/generate-mobile-assets.py

Outputs (all under apps/mobile/assets unless noted):
    icon.png             1024x1024  — Expo `icon` (iOS app icon master)
    adaptive-icon.png    1024x1024  — Android adaptive foreground (safe-zone aware)
    splash.png           1290x2796  — Expo splash (iPhone Pro Max class)
    favicon.png             64x64   — Web favicon
    brand-mark.png       1024x1024  — Transparent mark (no background panel)
    wordmark.png         1600x500   — Mark + "LifeOS AI" lockup, transparent
    store-icon.png       1024x1024  — App Store / Play Store square icon
    feature-graphic.png  1024x500   — Play Store feature graphic
    og-image.png         1200x630   — Social sharing card

Dependencies: Pillow >= 9. Uses Lato (SIL OFL) when available at the standard
Debian path, otherwise falls back to PIL's bitmap default.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "apps" / "mobile" / "assets"

# ---------------------------------------------------------------------------
# Brand palette (kept in sync with docs/BRAND_ASSETS.md)
# ---------------------------------------------------------------------------
INDIGO_950 = (10, 10, 23)
INDIGO_900 = (15, 23, 42)        # #0F172A — background dark
INDIGO_800 = (30, 27, 75)        # #1E1B4B
INDIGO_700 = (49, 46, 129)       # #312E81
INDIGO_600 = (79, 70, 229)       # #4F46E5 — primary
INDIGO_500 = (99, 102, 241)      # #6366F1
CYAN_500 = (6, 182, 212)         # #06B6D4 — secondary
CYAN_400 = (34, 211, 238)
CYAN_300 = (103, 232, 249)
GREEN_500 = (34, 197, 94)        # #22C55E — accent
AMBER_500 = (245, 158, 11)       # #F59E0B — warning accent
WHITE = (255, 255, 255)
SLATE_50 = (248, 250, 252)       # #F8FAFC
SLATE_300 = (203, 213, 225)
SLATE_400 = (148, 163, 184)

# ---------------------------------------------------------------------------
# Font discovery (system fonts only — no bundled font files)
# ---------------------------------------------------------------------------
FONT_CANDIDATES: dict[str, list[str]] = {
    "black": [
        "/usr/share/fonts/truetype/lato/Lato-Black.ttf",
        "/Library/Fonts/Arial Black.ttf",
        "C:/Windows/Fonts/ariblk.ttf",
    ],
    "bold": [
        "/usr/share/fonts/truetype/lato/Lato-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ],
    "semibold": [
        "/usr/share/fonts/truetype/lato/Lato-Semibold.ttf",
        "/usr/share/fonts/truetype/lato/Lato-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "regular": [
        "/usr/share/fonts/truetype/lato/Lato-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ],
}


def load_font(weight: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES.get(weight, []):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    # Fallback: PIL bitmap default. Not as crisp but ensures the script never
    # fails on a stripped system.
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Color + gradient helpers
# ---------------------------------------------------------------------------
def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(c1: Sequence[int], c2: Sequence[int], t: float) -> tuple[int, int, int]:
    return (int(lerp(c1[0], c2[0], t)), int(lerp(c1[1], c2[1], t)), int(lerp(c1[2], c2[2], t)))


def gradient_at(stops: Sequence[tuple[float, Sequence[int]]], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    for i in range(len(stops) - 1):
        a, b = stops[i], stops[i + 1]
        if a[0] <= t <= b[0]:
            span = max(1e-9, b[0] - a[0])
            return lerp_color(a[1], b[1], (t - a[0]) / span)
    return tuple(stops[-1][1])  # type: ignore[return-value]


def vertical_gradient(size: tuple[int, int], stops: Sequence[tuple[float, Sequence[int]]]) -> Image.Image:
    """Fast vertical gradient: build a 1px-wide strip then nearest-resize horizontally."""
    w, h = size
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for y in range(h):
        px[0, y] = gradient_at(stops, y / max(1, h - 1))
    return strip.resize(size, Image.NEAREST)


def diagonal_gradient(size: tuple[int, int], stops: Sequence[tuple[float, Sequence[int]]],
                      angle_deg: float = 135.0) -> Image.Image:
    """Render a small canvas pixel-by-pixel then upscale — keeps it fast."""
    w, h = size
    small_w = 256
    small_h = max(64, int(256 * h / max(1, w)))
    img = Image.new("RGB", (small_w, small_h))
    px = img.load()
    angle = math.radians(angle_deg)
    dx, dy = math.cos(angle), math.sin(angle)
    # project pixel onto direction; normalize over the full diagonal length
    length = abs(small_w * dx) + abs(small_h * dy)
    offset = (min(0, small_w * dx) + min(0, small_h * dy))
    for y in range(small_h):
        for x in range(small_w):
            t = ((x * dx + y * dy) - offset) / max(1e-9, length)
            px[x, y] = gradient_at(stops, t)
    return img.resize(size, Image.LANCZOS)


def radial_gradient(size: tuple[int, int],
                    inner: Sequence[int], outer: Sequence[int],
                    inner_alpha: int = 255, outer_alpha: int = 0,
                    falloff: float = 1.0) -> Image.Image:
    w, h = size
    small = 320
    img = Image.new("RGBA", (small, small))
    px = img.load()
    cx = cy = (small - 1) / 2
    max_r = small / 2
    for y in range(small):
        for x in range(small):
            r = math.hypot(x - cx, y - cy) / max_r
            r = min(1.0, r) ** falloff
            color = lerp_color(inner, outer, r)
            alpha = int(lerp(inner_alpha, outer_alpha, r))
            px[x, y] = (color[0], color[1], color[2], alpha)
    return img.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------
def rounded_rect_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_with_mask(base: Image.Image, overlay: Image.Image, mask: Image.Image | None = None,
                    box: tuple[int, int] = (0, 0)) -> None:
    base.paste(overlay, box, mask if mask is not None else overlay)


def soft_glow(size: tuple[int, int], color: Sequence[int], alpha: int = 180,
              radius_ratio: float = 0.45, blur: int = 60) -> Image.Image:
    """Returns an RGBA glow disc — useful as additive accent behind the mark."""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size[0] / 2, size[1] / 2
    r = min(size) * radius_ratio
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(color[0], color[1], color[2], alpha))
    return img.filter(ImageFilter.GaussianBlur(blur))


def alpha_rounded_rect(base: Image.Image, box: tuple[int, int, int, int], radius: int,
                       fill: tuple[int, int, int, int] | None = None,
                       outline: tuple[int, int, int, int] | None = None,
                       width: int = 1) -> None:
    """ImageDraw.rounded_rectangle overwrites pixels (no alpha blend). This helper
    draws to a transparent overlay then composites — needed for translucent panels."""
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle(
        box, radius=radius, fill=fill, outline=outline, width=width,
    )
    base.alpha_composite(overlay)


def alpha_ellipse(base: Image.Image, box: tuple[int, int, int, int],
                  fill: tuple[int, int, int, int]) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).ellipse(box, fill=fill)
    base.alpha_composite(overlay)


def draw_panel(size: tuple[int, int], radius_ratio: float = 0.22) -> Image.Image:
    """The icon background panel — vertical indigo gradient with corner rounding mask."""
    panel = vertical_gradient(size, [
        (0.0, INDIGO_900),
        (0.45, INDIGO_800),
        (1.0, INDIGO_700),
    ]).convert("RGBA")
    # Subtle vignette
    vignette = radial_gradient(size, INDIGO_950, (0, 0, 0), inner_alpha=0, outer_alpha=120, falloff=1.6)
    panel.alpha_composite(vignette)
    radius = int(min(size) * radius_ratio)
    mask = rounded_rect_mask(size, radius)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(panel, (0, 0), mask)
    return out


# ---------------------------------------------------------------------------
# The brand mark — orbit + central node + life-pillar dots.
# All sizes are derived from `size` so it scales cleanly from 48px to 1024px.
# Drawn at supersample = 3 then downsampled with LANCZOS for crisp AA.
# ---------------------------------------------------------------------------
def draw_brand_mark(size: int, *, simplified: bool = False, with_glow: bool = True,
                    glow_alpha: int = 170) -> Image.Image:
    SS = 3 if size >= 256 else 2
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    cx = cy = S / 2

    # --- Cyan glow halo behind the mark (additive feel via alpha).
    # Keep radius < 0.36 of canvas so the gaussian falls off entirely before
    # the square boundary, otherwise the glow shows visible edge artifacts.
    if with_glow:
        glow = soft_glow((S, S), CYAN_500, alpha=glow_alpha,
                         radius_ratio=0.32, blur=int(S * 0.075))
        img.alpha_composite(glow)
        glow2 = soft_glow((S, S), INDIGO_500, alpha=130,
                          radius_ratio=0.26, blur=int(S * 0.05))
        img.alpha_composite(glow2)

    draw = ImageDraw.Draw(img)

    # --- Outer orbit ring (gradient feel via two stacked rings)
    ring_outer_r = S * 0.42
    ring_thick = max(1, int(S * 0.030))
    # Base ring (indigo)
    draw.ellipse(
        (cx - ring_outer_r, cy - ring_outer_r, cx + ring_outer_r, cy + ring_outer_r),
        outline=INDIGO_500 + (255,), width=ring_thick,
    )
    # Cyan highlight arc (top-left) layered over the base for the gradient feel
    arc_box = (cx - ring_outer_r, cy - ring_outer_r, cx + ring_outer_r, cy + ring_outer_r)
    draw.arc(arc_box, start=200, end=20, fill=CYAN_400 + (255,), width=ring_thick)
    # Soft inner highlight
    draw.arc(arc_box, start=210, end=350, fill=WHITE + (110,), width=max(1, ring_thick // 2))

    # --- Inner secondary ring (thinner, broken — gives the "AI orbit" depth)
    if not simplified:
        inner_r = S * 0.30
        inner_thick = max(1, int(S * 0.014))
        draw.arc(
            (cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r),
            start=30, end=210, fill=CYAN_300 + (210,), width=inner_thick,
        )
        draw.arc(
            (cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r),
            start=240, end=320, fill=INDIGO_500 + (200,), width=inner_thick,
        )

    # --- Central "life node" (white core with cyan glow)
    core_r = S * 0.115
    # Soft white core glow
    core_glow = soft_glow((S, S), WHITE, alpha=140, radius_ratio=0.13, blur=int(S * 0.04))
    img.alpha_composite(core_glow)
    # Solid core with subtle tint
    draw.ellipse((cx - core_r, cy - core_r, cx + core_r, cy + core_r), fill=WHITE + (255,))
    # Inner tint dot
    inner_dot_r = core_r * 0.45
    draw.ellipse(
        (cx - inner_dot_r, cy - inner_dot_r, cx + inner_dot_r, cy + inner_dot_r),
        fill=CYAN_400 + (220,),
    )

    # --- Four life-pillar dots placed on the outer orbit (top, right, bottom, left)
    # representing schedule (cyan), finance (green), health (amber-ish indigo), goals (indigo)
    pillar_r = S * 0.045
    # angles in degrees, 0° = right; we place at top, right, bottom, left
    pillars = [
        (270, CYAN_400),    # top — schedule/today
        (0, GREEN_500),     # right — finance/growth
        (90, INDIGO_500),   # bottom — goals
        (180, CYAN_300),    # left — health/balance
    ]
    if simplified:
        # At very small sizes, three larger nodes read better than four small ones
        pillars = [
            (270, CYAN_400),
            (30, GREEN_500),
            (150, INDIGO_500),
        ]
        pillar_r = S * 0.060

    for angle_deg, color in pillars:
        a = math.radians(angle_deg)
        px = cx + math.cos(a) * ring_outer_r
        py = cy + math.sin(a) * ring_outer_r
        # Tiny outer glow per dot
        dot_glow_r = pillar_r * 2.2
        dot_glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(dot_glow).ellipse(
            (px - dot_glow_r, py - dot_glow_r, px + dot_glow_r, py + dot_glow_r),
            fill=color + (140,),
        )
        dot_glow = dot_glow.filter(ImageFilter.GaussianBlur(int(S * 0.012)))
        img.alpha_composite(dot_glow)
        # Solid dot with white inner highlight
        draw.ellipse((px - pillar_r, py - pillar_r, px + pillar_r, py + pillar_r),
                     fill=color + (255,))
        hl_r = pillar_r * 0.35
        draw.ellipse((px - hl_r - pillar_r * 0.25, py - hl_r - pillar_r * 0.25,
                      px + hl_r - pillar_r * 0.25, py + hl_r - pillar_r * 0.25),
                     fill=WHITE + (200,))

    return img.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Asset builders
# ---------------------------------------------------------------------------
def build_icon(size: int = 1024) -> Image.Image:
    panel = draw_panel((size, size), radius_ratio=0.225)
    mark = draw_brand_mark(int(size * 0.78))
    mx = (size - mark.width) // 2
    my = (size - mark.height) // 2
    panel.alpha_composite(mark, (mx, my))
    return panel


def build_store_icon(size: int = 1024) -> Image.Image:
    """Same composition as app icon but radius near 0 — store renderers add their own mask."""
    panel_size = (size, size)
    panel = vertical_gradient(panel_size, [
        (0.0, INDIGO_900),
        (0.5, INDIGO_800),
        (1.0, INDIGO_700),
    ]).convert("RGBA")
    panel.alpha_composite(radial_gradient(panel_size, INDIGO_950, (0, 0, 0),
                                          inner_alpha=0, outer_alpha=120, falloff=1.6))
    mark = draw_brand_mark(int(size * 0.74))
    mx = (size - mark.width) // 2
    my = (size - mark.height) // 2
    panel.alpha_composite(mark, (mx, my))
    return panel


def build_adaptive_icon(size: int = 1024) -> Image.Image:
    """Android adaptive foreground.

    Android crops the foreground in a circle of diameter = 66% of the canvas
    (0.66 * 1024 ≈ 676 px). Our content sits comfortably inside a 60% disc so
    no detail gets clipped under any system mask shape.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Large enough mark + glow to feel substantial, small enough to survive the safe-zone crop.
    mark = draw_brand_mark(int(size * 0.60), with_glow=True, glow_alpha=210)
    mx = (size - mark.width) // 2
    my = (size - mark.height) // 2
    img.alpha_composite(mark, (mx, my))
    return img


def build_brand_mark(size: int = 1024) -> Image.Image:
    """Transparent mark — for marketing surfaces / wordmark composition."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = draw_brand_mark(size)
    img.alpha_composite(mark)
    return img


def build_favicon(size: int = 64) -> Image.Image:
    # At 64px the orbit + 4 dots get fuzzy. Use the simplified 3-node variant.
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = draw_brand_mark(size, simplified=True, with_glow=False)
    img.alpha_composite(mark)
    return img


def build_splash(size: tuple[int, int] = (1290, 2796)) -> Image.Image:
    w, h = size
    bg = vertical_gradient(size, [
        (0.0, INDIGO_900),
        (0.55, INDIGO_800),
        (1.0, INDIGO_700),
    ]).convert("RGBA")

    # Centered radial accent behind the mark
    accent = radial_gradient((int(w * 1.4), int(w * 1.4)), CYAN_500, INDIGO_700,
                             inner_alpha=160, outer_alpha=0, falloff=1.4)
    ax = (w - accent.width) // 2
    ay = int(h * 0.32) - accent.height // 2
    bg.alpha_composite(accent, (ax, ay))

    # Mark
    mark_size = int(w * 0.42)
    mark = draw_brand_mark(mark_size)
    mx = (w - mark.width) // 2
    my = int(h * 0.36) - mark.height // 2
    bg.alpha_composite(mark, (mx, my))

    # Wordmark "LifeOS AI"
    title_font = load_font("black", int(w * 0.105))
    subtitle_font = load_font("regular", int(w * 0.034))
    draw = ImageDraw.Draw(bg)

    title = "LifeOS AI"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (w - tw) // 2 - bbox[0]
    ty = my + mark.height + int(h * 0.025)
    # Soft shadow
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((tx, ty + 4), title, font=title_font, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    bg.alpha_composite(shadow)
    draw.text((tx, ty), title, font=title_font, fill=WHITE + (255,))

    subtitle = "Trợ lý cá nhân thông minh"
    sb = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]
    sx = (w - sw) // 2 - sb[0]
    sy = ty + th + int(h * 0.018)
    draw.text((sx, sy), subtitle, font=subtitle_font, fill=SLATE_300 + (255,))

    # Tiny pillar legend — three muted pills near bottom give visual anchor
    pill_font = load_font("semibold", int(w * 0.025))
    labels = ["Today", "Health", "Finance"]
    colors = [CYAN_400, GREEN_500, INDIGO_500]
    pill_y = int(h * 0.84)
    pill_h = int(w * 0.06)
    pill_padx = int(w * 0.035)
    gap = int(w * 0.025)
    # Measure
    measured = []
    for label, color in zip(labels, colors):
        bb = draw.textbbox((0, 0), label, font=pill_font)
        measured.append((label, color, bb[2] - bb[0], bb[3] - bb[1], bb))
    total_w = sum(m[2] + 2 * pill_padx for m in measured) + gap * (len(measured) - 1)
    cur_x = (w - total_w) // 2
    for label, color, lw, lh, bb in measured:
        pill_w = lw + 2 * pill_padx
        # Translucent rounded pill — must alpha-composite, not direct-draw,
        # otherwise the alpha just overwrites and looks opaque.
        alpha_rounded_rect(
            bg,
            (cur_x, pill_y, cur_x + pill_w, pill_y + pill_h),
            radius=pill_h // 2,
            fill=(255, 255, 255, 36),
            outline=color + (210,),
            width=3,
        )
        # dot
        dot_r = int(pill_h * 0.20)
        dx = cur_x + pill_padx - int(pill_padx * 0.20)
        dy = pill_y + pill_h // 2
        ImageDraw.Draw(bg).ellipse((dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r),
                                   fill=color + (255,))
        # text — center vertically inside pill
        text_x = dx + dot_r + int(pill_padx * 0.45) - bb[0]
        text_y = pill_y + (pill_h - lh) // 2 - bb[1]
        ImageDraw.Draw(bg).text((text_x, text_y), label, font=pill_font, fill=WHITE + (240,))
        cur_x += pill_w + gap

    return bg.convert("RGB")


def build_wordmark(size: tuple[int, int] = (1600, 500)) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))

    mark_size = int(h * 0.78)
    mark = draw_brand_mark(mark_size)
    title_font = load_font("black", int(h * 0.40))
    tagline_font = load_font("semibold", int(h * 0.10))

    draw = ImageDraw.Draw(img)
    title = "LifeOS"
    suffix = " AI"
    tagline = "Personal life OS"

    tb = draw.textbbox((0, 0), title, font=title_font)
    sb = draw.textbbox((0, 0), suffix, font=title_font)
    tag_bb = draw.textbbox((0, 0), tagline, font=tagline_font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    sw = sb[2] - sb[0]
    tag_w, tag_h = tag_bb[2] - tag_bb[0], tag_bb[3] - tag_bb[1]

    text_block_w = tw + sw  # title + suffix on one line
    gap = int(h * 0.10)
    total_w = mark_size + gap + text_block_w
    start_x = (w - total_w) // 2
    mark_x = start_x
    mark_y = (h - mark_size) // 2
    img.alpha_composite(mark, (mark_x, mark_y))

    # Vertically center the title + tagline as a stacked group
    line_gap = int(h * 0.04)
    block_h = th + line_gap + tag_h
    block_top = (h - block_h) // 2

    text_x = start_x + mark_size + gap
    title_y = block_top - tb[1]
    draw.text((text_x, title_y), title, font=title_font, fill=INDIGO_900 + (255,))
    draw.text((text_x + tw, title_y), suffix, font=title_font, fill=INDIGO_600 + (255,))

    tag_y = block_top + th + line_gap - tag_bb[1]
    draw.text((text_x, tag_y), tagline, font=tagline_font, fill=SLATE_400 + (255,))

    return img


def build_feature_graphic(size: tuple[int, int] = (1024, 500)) -> Image.Image:
    w, h = size
    bg = diagonal_gradient(size, [
        (0.0, INDIGO_900),
        (0.6, INDIGO_700),
        (1.0, INDIGO_600),
    ], angle_deg=20).convert("RGBA")

    # Floating cyan accent on the right
    accent = radial_gradient((int(w * 0.7), int(w * 0.7)), CYAN_500, INDIGO_700,
                             inner_alpha=170, outer_alpha=0, falloff=1.5)
    bg.alpha_composite(accent, (int(w * 0.55), int(-h * 0.4)))

    # Mark on the left
    mark_size = int(h * 0.72)
    mark = draw_brand_mark(mark_size)
    mark_x = int(w * 0.06)
    mark_y = (h - mark_size) // 2
    bg.alpha_composite(mark, (mark_x, mark_y))

    # Title + tagline on the right. Box-fit the tagline so it never overflows
    # the canvas regardless of language choice.
    title_font = load_font("black", int(h * 0.20))
    draw = ImageDraw.Draw(bg)
    title = "LifeOS AI"
    title_x = mark_x + mark_size + int(w * 0.04)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    title_h = bbox[3] - bbox[1]

    tagline = "Quản lý cuộc sống thông minh hơn mỗi ngày"
    available_w = w - title_x - int(w * 0.04)
    # Fit tagline by shrinking font size until it fits the available width
    tagline_size = int(h * 0.075)
    while tagline_size > 18:
        tagline_font = load_font("semibold", tagline_size)
        tg_bb = draw.textbbox((0, 0), tagline, font=tagline_font)
        if tg_bb[2] - tg_bb[0] <= available_w:
            break
        tagline_size -= 2
    tagline_font = load_font("semibold", tagline_size)
    tg_bb = draw.textbbox((0, 0), tagline, font=tagline_font)
    tag_h = tg_bb[3] - tg_bb[1]

    # Vertically center title + tagline as a group
    line_gap = int(h * 0.05)
    block_h = title_h + line_gap + tag_h
    block_top = (h - block_h) // 2

    title_y = block_top - bbox[1]
    draw.text((title_x, title_y), title, font=title_font, fill=WHITE + (255,))
    tag_y = block_top + title_h + line_gap - tg_bb[1]
    draw.text((title_x, tag_y), tagline, font=tagline_font, fill=SLATE_300 + (255,))

    return bg.convert("RGB")


def build_og_image(size: tuple[int, int] = (1200, 630)) -> Image.Image:
    w, h = size
    bg = vertical_gradient(size, [
        (0.0, INDIGO_900),
        (0.6, INDIGO_800),
        (1.0, INDIGO_700),
    ]).convert("RGBA")

    # Cyan radial behind mark
    accent = radial_gradient((int(w * 0.6), int(w * 0.6)), CYAN_500, INDIGO_700,
                             inner_alpha=150, outer_alpha=0, falloff=1.5)
    bg.alpha_composite(accent, (-int(w * 0.1), -int(w * 0.15)))

    # Mark + wordmark left side
    mark_size = int(h * 0.42)
    mark = draw_brand_mark(mark_size)
    mark_x = int(w * 0.07)
    mark_y = int(h * 0.16)
    bg.alpha_composite(mark, (mark_x, mark_y))

    title_font = load_font("black", int(h * 0.13))
    tagline_font = load_font("semibold", int(h * 0.045))
    label_font = load_font("semibold", int(h * 0.030))
    value_font = load_font("bold", int(h * 0.050))
    sub_font = load_font("regular", int(h * 0.028))

    draw = ImageDraw.Draw(bg)
    title = "LifeOS AI"
    tx = mark_x + mark_size + int(w * 0.03)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    th_ = bbox[3] - bbox[1]

    tagline = "Your personal life companion"
    tg_bb = draw.textbbox((0, 0), tagline, font=tagline_font)
    tag_h = tg_bb[3] - tg_bb[1]

    # Vertically center title + tagline next to the mark
    line_gap = int(h * 0.025)
    block_h = th_ + line_gap + tag_h
    block_top = mark_y + (mark_size - block_h) // 2
    ty = block_top - bbox[1]
    draw.text((tx, ty), title, font=title_font, fill=WHITE + (255,))
    tag_y = block_top + th_ + line_gap - tg_bb[1]
    draw.text((tx, tag_y), tagline, font=tagline_font, fill=SLATE_300 + (255,))

    # Mock cards row at the bottom
    cards = [
        ("TODAY",    "5 tasks",      CYAN_400),
        ("FINANCE",  "+12% saved",   GREEN_500),
        ("HEALTH",   "7h 42m sleep", CYAN_300),
        ("AI",       "3 nudges",     INDIGO_500),
    ]
    card_w = int(w * 0.205)
    card_h = int(h * 0.27)
    card_gap = int(w * 0.018)
    total_cw = card_w * len(cards) + card_gap * (len(cards) - 1)
    start_x = (w - total_cw) // 2
    card_y = int(h * 0.60)
    for i, (label, value, color) in enumerate(cards):
        x = start_x + i * (card_w + card_gap)
        # Card background — translucent white panel with colored top accent.
        # Must alpha-composite, otherwise the alpha is overwritten and the
        # card renders solid white (hiding white value text).
        alpha_rounded_rect(
            bg,
            (x, card_y, x + card_w, card_y + card_h),
            radius=int(card_h * 0.16),
            fill=(255, 255, 255, 38),
            outline=(255, 255, 255, 90),
            width=2,
        )
        # Color accent dot (top-left)
        accent_r = int(card_h * 0.07)
        ax = x + int(card_w * 0.10) + accent_r
        ay = card_y + int(card_h * 0.22) + accent_r
        ImageDraw.Draw(bg).ellipse((ax - accent_r, ay - accent_r, ax + accent_r, ay + accent_r),
                                   fill=color + (255,))
        # Label
        lb = draw.textbbox((0, 0), label, font=label_font)
        lx = ax + accent_r + int(card_w * 0.05) - lb[0]
        ly = ay - (lb[3] - lb[1]) // 2 - lb[1]
        draw.text((lx, ly), label, font=label_font, fill=SLATE_50 + (235,))
        # Value
        vb = draw.textbbox((0, 0), value, font=value_font)
        vx = x + int(card_w * 0.10) - vb[0]
        vy = card_y + int(card_h * 0.62) - vb[1]
        draw.text((vx, vy), value, font=value_font, fill=WHITE + (255,))

    # Bottom-right URL hint
    url = "lifeos.ai"
    ub = draw.textbbox((0, 0), url, font=sub_font)
    draw.text((w - (ub[2] - ub[0]) - int(w * 0.04) - ub[0],
               h - (ub[3] - ub[1]) - int(h * 0.025) - ub[1]),
              url, font=sub_font, fill=SLATE_400 + (220,))

    return bg.convert("RGB")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
def save_png(img: Image.Image, path: Path, *, expected_size: tuple[int, int]) -> None:
    if img.size != expected_size:
        raise RuntimeError(f"Size mismatch for {path}: got {img.size}, expected {expected_size}")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"  ✓ {path.relative_to(REPO_ROOT)}  ({img.size[0]}×{img.size[1]}, {path.stat().st_size // 1024} KB)")


def main() -> None:
    print(f"Generating LifeOS AI brand assets → {ASSETS_DIR.relative_to(REPO_ROOT)}")
    targets: list[tuple[str, callable, tuple[int, int]]] = [
        ("icon.png",            lambda: build_icon(1024),                (1024, 1024)),
        ("adaptive-icon.png",   lambda: build_adaptive_icon(1024),       (1024, 1024)),
        ("splash.png",          lambda: build_splash((1290, 2796)),      (1290, 2796)),
        ("favicon.png",         lambda: build_favicon(64),               (64, 64)),
        ("brand-mark.png",      lambda: build_brand_mark(1024),          (1024, 1024)),
        ("wordmark.png",        lambda: build_wordmark((1600, 500)),     (1600, 500)),
        ("store-icon.png",      lambda: build_store_icon(1024),          (1024, 1024)),
        ("feature-graphic.png", lambda: build_feature_graphic((1024, 500)), (1024, 500)),
        ("og-image.png",        lambda: build_og_image((1200, 630)),     (1200, 630)),
    ]
    for filename, builder, size in targets:
        out_path = ASSETS_DIR / filename
        img = builder()
        save_png(img, out_path, expected_size=size)
    print("Done.")


if __name__ == "__main__":
    main()
