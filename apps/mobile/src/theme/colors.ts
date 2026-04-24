export const palette = {
  // brand
  brand500: '#6366F1',
  brand600: '#4F46E5',
  brand400: '#818CF8',

  // accents
  amber: '#F59E0B',
  rose: '#F43F5E',
  emerald: '#10B981',
  sky: '#0EA5E9',
  violet: '#A78BFA',
};

export const lightTheme = {
  bg: '#F7F7FB',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F2F6',
  border: '#E5E7EB',
  text: '#0F172A',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',
  primary: palette.brand500,
  primaryStrong: palette.brand600,
  success: palette.emerald,
  warning: palette.amber,
  danger: palette.rose,
  info: palette.sky,
  overlay: 'rgba(15, 23, 42, 0.5)',
};

export const darkTheme: typeof lightTheme = {
  bg: '#0B0B12',
  bgElevated: '#15151E',
  surface: '#1A1A24',
  surfaceMuted: '#21212D',
  border: '#2A2A38',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textInverse: '#0F172A',
  primary: palette.brand400,
  primaryStrong: palette.brand500,
  success: palette.emerald,
  warning: palette.amber,
  danger: palette.rose,
  info: palette.sky,
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type ThemeColors = typeof lightTheme;
