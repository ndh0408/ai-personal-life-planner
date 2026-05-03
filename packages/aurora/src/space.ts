/**
 * Aurora spacing — 4pt grid. More generous than v2; whitespace is the
 * design here. Default screen padding is 24, not 20.
 */
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
  '9': 48,
  '10': 56,
  '12': 80,
  '14': 120,
} as const;
export type Space = keyof typeof space;

/** Aurora radii — softer; even tiles are rounded heavily. */
export const radius = {
  none: 0,
  xs: 6,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  '2xl': 36,
  '3xl': 44,
  pill: 999,
} as const;
export type Radius = keyof typeof radius;

export const hitSize = 44;
export const screenEdge = { ios: 24, android: 20 } as const;
