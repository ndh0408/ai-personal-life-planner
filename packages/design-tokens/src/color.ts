/**
 * Warm Calm Luxury palette. Dark is canonical; light derives from the same hues.
 *
 * Hex literals live here — every other layer must consume by semantic name.
 * Round 40 refresh keeps the existing sienna accent (Editorial Calm v1) but
 * introduces a parallel "champagne gold" for hero / restraint moments. Both
 * are exported so the redesign can A/B in-place without breaking R31..R39.
 */

export const palette = {
  /** Backgrounds — warm near-black, never pure #000. */
  ink: {
    canvas: '#0E0D0B',
    surface: '#16140F',
    elevated: '#1E1B16',
    inset: '#0A0907',
  },
  /** Bone whites with a touch of warmth — never #FFFFFF. */
  bone: {
    primary: '#F4EFE6',
    secondary: '#A8A095',
    tertiary: '#6E675D',
    onAccent: '#0E0D0B',
  },
  /** Accents. `gold` is the new luxury primary; `sienna` is the inherited R17 accent. */
  gold: {
    base: '#C9A66B',
    glow: '#E8C892',
    pressed: '#A48750',
    soft: 'rgba(201, 166, 107, 0.16)',
    softer: 'rgba(201, 166, 107, 0.08)',
  },
  sienna: {
    base: '#D08A5C',
    pressed: '#B86A3C',
    soft: 'rgba(208, 138, 92, 0.16)',
  },
  /** Status. Muted, magazine-like — no candy reds or neon greens. */
  status: {
    success: '#7FA670',
    warning: '#D4A656',
    danger: '#C97B6B',
    info: '#7B9DB8',
  },
  /** Capture-kind hues. */
  kind: {
    expense: '#C9624A',
    income: '#7FA66B',
    task: '#7B9DB8',
    meal: '#7FA670',
    sleep: '#9085C7',
    mood: '#D4A656',
    note: '#C9A66B',
    unknown: '#6E675D',
  },
  /** Hairline strokes done with rgba over surface. */
  stroke: {
    hairline: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.14)',
  },
  scrim: {
    soft: 'rgba(0, 0, 0, 0.32)',
    medium: 'rgba(0, 0, 0, 0.48)',
    strong: 'rgba(0, 0, 0, 0.62)',
  },
} as const;

/**
 * Semantic color tokens. Components MUST consume from `color`, not `palette`.
 * Swap palette → re-skin app.
 */
export const colorDark = {
  bg: {
    canvas: palette.ink.canvas,
    surface: palette.ink.surface,
    elevated: palette.ink.elevated,
    inset: palette.ink.inset,
  },
  text: {
    primary: palette.bone.primary,
    secondary: palette.bone.secondary,
    tertiary: palette.bone.tertiary,
    onAccent: palette.bone.onAccent,
    link: palette.gold.glow,
  },
  border: {
    hairline: palette.stroke.hairline,
    base: palette.stroke.border,
    strong: palette.stroke.strong,
    accent: palette.gold.base,
  },
  accent: {
    base: palette.gold.base,
    glow: palette.gold.glow,
    pressed: palette.gold.pressed,
    soft: palette.gold.soft,
    softer: palette.gold.softer,
  },
  status: {
    success: { fg: palette.status.success, bg: 'rgba(127, 166, 112, 0.18)' },
    warning: { fg: palette.status.warning, bg: 'rgba(212, 166, 86, 0.18)' },
    danger: { fg: palette.status.danger, bg: 'rgba(201, 123, 107, 0.18)' },
    info: { fg: palette.status.info, bg: 'rgba(123, 157, 184, 0.18)' },
  },
  kind: palette.kind,
  scrim: palette.scrim,
} as const;

/**
 * Light mode — warm cream base. Same semantic shape as dark; component code
 * never branches on theme, it reads `color.text.primary` and the provider
 * supplies the right map.
 */
export const colorLight = {
  bg: {
    canvas: '#FAF7F0',
    surface: '#F4EFE4',
    elevated: '#FFFFFF',
    inset: '#EFEAE0',
  },
  text: {
    primary: '#1A1814',
    secondary: '#4A453E',
    tertiary: '#7A736A',
    onAccent: '#0E0D0B',
    link: palette.gold.pressed,
  },
  border: {
    hairline: 'rgba(0, 0, 0, 0.06)',
    base: 'rgba(0, 0, 0, 0.10)',
    strong: 'rgba(0, 0, 0, 0.16)',
    accent: palette.gold.pressed,
  },
  accent: {
    base: palette.gold.pressed,
    glow: palette.gold.base,
    pressed: '#856838',
    soft: 'rgba(164, 135, 80, 0.14)',
    softer: 'rgba(164, 135, 80, 0.06)',
  },
  status: {
    success: { fg: '#5A7E50', bg: 'rgba(90, 126, 80, 0.14)' },
    warning: { fg: '#9C7A36', bg: 'rgba(156, 122, 54, 0.14)' },
    danger: { fg: '#9C5446', bg: 'rgba(156, 84, 70, 0.14)' },
    info: { fg: '#557390', bg: 'rgba(85, 115, 144, 0.14)' },
  },
  kind: palette.kind,
  scrim: palette.scrim,
} as const;

/** Widened from literal-typed colorDark — both dark and light fit this shape. */
export type ColorTokens = {
  bg: { canvas: string; surface: string; elevated: string; inset: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    onAccent: string;
    link: string;
  };
  border: { hairline: string; base: string; strong: string; accent: string };
  accent: { base: string; glow: string; pressed: string; soft: string; softer: string };
  status: {
    success: { fg: string; bg: string };
    warning: { fg: string; bg: string };
    danger: { fg: string; bg: string };
    info: { fg: string; bg: string };
  };
  kind: typeof palette.kind;
  scrim: typeof palette.scrim;
};

export type ColorScheme = 'dark' | 'light';

export const colorByScheme: Record<ColorScheme, ColorTokens> = {
  dark: colorDark,
  light: colorLight,
};
