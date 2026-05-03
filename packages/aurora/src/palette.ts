/**
 * Aurora palette — dawn-to-dusk dynamic.
 *
 * The canvas is a *living* mesh gradient that morphs by hour-of-day. Five
 * named moments anchor the lerp; everything in between interpolates
 * linearly. Components reading `useAuroraScheme()` get the current
 * resolved colors — they never reach into raw hex below.
 *
 * Design intent: ditch warm-dark luxury (Round 17-41). Aurora is futuristic,
 * reflective, breathing — closer to Apple Vision Pro / Linear / Arc than to
 * Editorial Calm.
 */

/** Five anchor moments. Linear interp between them by minutes-of-day. */
export const moments = {
  /** 22:00–05:00. Deep indigo, silver edge — quiet hours. */
  night: {
    canvasA: '#0A0B1F',
    canvasB: '#0F0A24',
    glassTint: 'rgba(180, 200, 255, 0.06)',
    accent: '#C9D2F0',
    accentGlow: '#9FA8D6',
    inkPrimary: '#F0F2FA',
    inkSecondary: '#9CA3C5',
    inkTertiary: '#5C6588',
  },
  /** 05:00–09:00. Coral sunrise, warm lift. */
  dawn: {
    canvasA: '#1A0E2E',
    canvasB: '#3A1A3E',
    glassTint: 'rgba(255, 180, 160, 0.10)',
    accent: '#FF8E72',
    accentGlow: '#FFB89E',
    inkPrimary: '#FFF4ED',
    inkSecondary: '#D9B5A8',
    inkTertiary: '#8C6F66',
  },
  /** 09:00–14:00. Crystalline midday — turquoise clarity. */
  noon: {
    canvasA: '#0E2336',
    canvasB: '#16384F',
    glassTint: 'rgba(140, 220, 230, 0.10)',
    accent: '#5DDDD5',
    accentGlow: '#9FF0EA',
    inkPrimary: '#EFF8FA',
    inkSecondary: '#A5C4CC',
    inkTertiary: '#5A7A85',
  },
  /** 14:00–19:00. Golden afternoon, warm violet shadow. */
  afternoon: {
    canvasA: '#1F1538',
    canvasB: '#2D1A45',
    glassTint: 'rgba(255, 200, 160, 0.10)',
    accent: '#E5B07F',
    accentGlow: '#F5D4A5',
    inkPrimary: '#FBF3E8',
    inkSecondary: '#C9B7A0',
    inkTertiary: '#7A6B5A',
  },
  /** 19:00–22:00. Lavender dusk, contemplative. */
  dusk: {
    canvasA: '#170E2F',
    canvasB: '#2A1652',
    glassTint: 'rgba(180, 150, 255, 0.10)',
    accent: '#B89AF5',
    accentGlow: '#D6C2FF',
    inkPrimary: '#F4F0FF',
    inkSecondary: '#B8A8D6',
    inkTertiary: '#6B5F8A',
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

/** Status colors. Stable across moments — readability matters more than mood. */
export const status = {
  success: '#7FE8A4',
  warning: '#F5C566',
  danger: '#FF8579',
  info: '#7DB7FF',
} as const;

/** Capture-kind hues — stable across moments so the badge color never shifts. */
export const kind = {
  expense: '#FF8579',
  income: '#7FE8A4',
  task: '#7DB7FF',
  meal: '#A5E89F',
  sleep: '#B89AF5',
  mood: '#F5C566',
  note: '#C9D2F0',
  idea: '#FFB89E',
  event: '#5DDDD5',
  unknown: '#7C829A',
} as const;
