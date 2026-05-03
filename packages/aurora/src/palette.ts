/**
 * Aurora palette — muted midnight indigo with champagne pearl accent.
 *
 * The canvas is a *living* mesh gradient that morphs by hour-of-day. Five
 * named moments anchor the lerp; everything in between interpolates linearly.
 * Components reading `useAuroraScheme()` get the resolved colors — they never
 * reach into raw hex below.
 *
 * Design intent (R45): premium, restrained, sophisticated. All canvases stay
 * in the indigo–violet family (no candy coral / neon teal). One accent —
 * champagne pearl (#E8D5B2) — carries active states across the whole app,
 * with soft lavender as the ambient companion. Status & kind hues are muted
 * to magazine-like saturation.
 */

/** Five anchor moments. Linear interp between them by minutes-of-day. */
export const moments = {
  /** 22:00–05:00. Deepest midnight — pearl over silver-lavender. */
  night: {
    canvasA: '#0E0B1F',
    canvasB: '#15113A',
    glassTint: 'rgba(255, 255, 255, 0.06)',
    accent: '#E8D5B2',
    accentGlow: '#B5A8E0',
    inkPrimary: '#F5F1E8',
    inkSecondary: '#D5CFC0',
    inkTertiary: '#8D88A6',
  },
  /** 05:00–09:00. Indigo wash with first hint of warmth. */
  dawn: {
    canvasA: '#1A1740',
    canvasB: '#322856',
    glassTint: 'rgba(255, 255, 255, 0.07)',
    accent: '#E8D5B2',
    accentGlow: '#F0DCB8',
    inkPrimary: '#F5F1E8',
    inkSecondary: '#D5CFC0',
    inkTertiary: '#8D88A6',
  },
  /** 09:00–14:00. Indigo with cool clarity, brightest glass. */
  noon: {
    canvasA: '#1F1B4D',
    canvasB: '#252148',
    glassTint: 'rgba(255, 255, 255, 0.09)',
    accent: '#E8D5B2',
    accentGlow: '#B5A8E0',
    inkPrimary: '#F5F1E8',
    inkSecondary: '#D5CFC0',
    inkTertiary: '#8D88A6',
  },
  /** 14:00–19:00. Plum afternoon — warmer pearl with gold halo. */
  afternoon: {
    canvasA: '#1F1B40',
    canvasB: '#322856',
    glassTint: 'rgba(255, 255, 255, 0.07)',
    accent: '#E8D5B2',
    accentGlow: '#D4B068',
    inkPrimary: '#F5F1E8',
    inkSecondary: '#D5CFC0',
    inkTertiary: '#8D88A6',
  },
  /** 19:00–22:00. Lavender dusk, contemplative. */
  dusk: {
    canvasA: '#1A1740',
    canvasB: '#251F4D',
    glassTint: 'rgba(255, 255, 255, 0.08)',
    accent: '#B5A8E0',
    accentGlow: '#E8D5B2',
    inkPrimary: '#F5F1E8',
    inkSecondary: '#D5CFC0',
    inkTertiary: '#8D88A6',
  },
} as const;

export type Moment = keyof typeof moments;
export type MomentPalette = (typeof moments)[Moment];

/** Pick the active moment by local hour. */
export function momentForHour(h: number): Moment {
  if (h < 5) return 'night';
  if (h < 9) return 'dawn';
  if (h < 14) return 'noon';
  if (h < 19) return 'afternoon';
  if (h < 22) return 'dusk';
  return 'night';
}

/** Status colors. Muted, magazine-like — no candy reds or neon greens. */
export const status = {
  success: '#8FB3A3',
  warning: '#D4B068',
  danger: '#C49AAB',
  info: '#7B9DB8',
} as const;

/** Capture-kind hues — muted family that sits next to the pearl accent. */
export const kind = {
  expense: '#C49AAB',
  income: '#8FB3A3',
  task: '#7B9DB8',
  meal: '#8FB3A3',
  sleep: '#B5A8E0',
  mood: '#D4B068',
  note: '#E8D5B2',
  idea: '#E8D5B2',
  event: '#B5A8E0',
  unknown: '#8D88A6',
} as const;
