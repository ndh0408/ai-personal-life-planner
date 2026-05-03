/** 4-pt grid — 8 stays the dominant unit. */
export const space = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 32,
  '8': 40,
  '10': 56,
  '12': 80,
} as const;
export type Space = keyof typeof space;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 999,
} as const;
export type Radius = keyof typeof radius;

/**
 * Touch target floor — Material 48dp / iOS HIG 44pt. 44 covers both since RN
 * dp ~= iOS pt. Keep this single canonical value.
 */
export const hitSize = 44;

/** Screen edge padding by platform. iOS: 20, Android (Material): 16. */
export const screenEdge = { ios: 20, android: 16 } as const;
