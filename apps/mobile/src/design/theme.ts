/**
 * Editorial Calm — see docs/MOBILE_DESIGN_SYSTEM.md.
 * Single source of truth for colours/spacing/typography.
 */
export const palette = {
  canvas: '#0B0B0F',
  surface: '#15151B',
  surfaceAlt: '#1F1F27',
  border: '#252530',
  textPrimary: '#F4EFE7',
  textSecondary: '#9C968B',
  textMuted: '#6B6760',
  textInverse: '#0B0B0F',
  accent: '#C97B4A',
  accentPressed: '#B86A3C',
  success: '#7FA66B',
  warning: '#D6A24E',
  danger: '#C9624A',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const typography = {
  kicker: { fontSize: 12, letterSpacing: 2, fontWeight: '600' as const },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyEm: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
};
