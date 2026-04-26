import type { TextStyle } from 'react-native';

/**
 * Modular scale base 16, ratio 1.25. Keep the styles plain so they survive
 * RN's StyleSheet.flatten without the platform-specific weight/family adapter.
 */
export const typography: Record<string, TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyEm: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  kicker: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  number: { fontSize: 28, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export type TypoVariant = keyof typeof typography;
