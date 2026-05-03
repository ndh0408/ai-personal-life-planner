/**
 * Typography. Platform font selection is left to the consumer (mobile picks
 * SF Pro on iOS, Inter on Android). Sizes / weights / tracking are constant.
 *
 * Rule: never use bold to emphasize prose. Use size + color + space.
 */

export const fontFamily = {
  /** Sans display — large numbers, hero titles. */
  display: { ios: 'SF Pro Display', android: 'Inter' },
  /** Sans body — UI prose. */
  text: { ios: 'SF Pro Text', android: 'Inter' },
  /** Mono — tabular numbers, data. NEVER for prose. */
  mono: { ios: 'SF Mono', android: 'JetBrains Mono' },
} as const;

export type FontStyle = {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700';
  /** em units — converters do `letterSpacing * size` for RN. */
  trackingEm: number;
  family: 'display' | 'text' | 'mono';
};

export const typography: Record<string, FontStyle> = {
  displayL: { size: 34, lineHeight: 40, weight: '600', trackingEm: -0.02, family: 'display' },
  displayM: { size: 28, lineHeight: 34, weight: '600', trackingEm: -0.015, family: 'display' },
  titleL: { size: 22, lineHeight: 28, weight: '600', trackingEm: -0.01, family: 'display' },
  titleM: { size: 17, lineHeight: 24, weight: '600', trackingEm: -0.005, family: 'text' },
  bodyL: { size: 17, lineHeight: 24, weight: '400', trackingEm: 0, family: 'text' },
  bodyM: { size: 15, lineHeight: 22, weight: '400', trackingEm: 0, family: 'text' },
  bodyS: { size: 13, lineHeight: 20, weight: '400', trackingEm: 0, family: 'text' },
  caption: { size: 13, lineHeight: 18, weight: '500', trackingEm: 0.005, family: 'text' },
  micro: { size: 11, lineHeight: 14, weight: '600', trackingEm: 0.02, family: 'text' },
  kicker: { size: 11, lineHeight: 14, weight: '700', trackingEm: 0.12, family: 'text' },
  monoData: { size: 14, lineHeight: 20, weight: '500', trackingEm: 0, family: 'mono' },
};

export type TypoVariant = keyof typeof typography;
