/**
 * Aurora typography. Extreme contrast: oversized serif display (Fraunces
 * variable, optical opsz=144 for hero) + tight sans body (Inter Tight).
 *
 * Bold is a tool, not a habit — most of the visual weight comes from SIZE
 * and color, not weight. Numbers always tabular.
 */

export const fontFamily = {
  /** Hero serif. Variable Fraunces with high optical size + soft slope. */
  display: { ios: 'Fraunces', android: 'Fraunces', fallback: 'Times New Roman' },
  /** UI sans. Inter Tight prefers a denser feel than vanilla Inter. */
  text: { ios: 'InterTight-Regular', android: 'InterTight', fallback: 'Inter' },
  /** Tabular numerics + JSON snippets in "Why this?". */
  mono: { ios: 'JetBrainsMono-Regular', android: 'JetBrainsMono', fallback: 'Menlo' },
} as const;

export type FontStyle = {
  size: number;
  lineHeight: number;
  weight: '300' | '400' | '500' | '600' | '700' | '800';
  trackingEm: number;
  family: 'display' | 'text' | 'mono';
};

export const typography: Record<string, FontStyle> = {
  /** Hero serif — only used once per screen. */
  hero: { size: 56, lineHeight: 60, weight: '500', trackingEm: -0.04, family: 'display' },
  /** Big headline serif. */
  displayL: { size: 40, lineHeight: 46, weight: '500', trackingEm: -0.03, family: 'display' },
  displayM: { size: 32, lineHeight: 38, weight: '500', trackingEm: -0.025, family: 'display' },
  /** Section serif. */
  titleL: { size: 24, lineHeight: 30, weight: '500', trackingEm: -0.02, family: 'display' },
  titleM: { size: 18, lineHeight: 24, weight: '600', trackingEm: -0.01, family: 'text' },
  /** UI sans. */
  bodyL: { size: 17, lineHeight: 26, weight: '400', trackingEm: -0.005, family: 'text' },
  bodyM: { size: 15, lineHeight: 22, weight: '400', trackingEm: 0, family: 'text' },
  bodyS: { size: 13, lineHeight: 18, weight: '400', trackingEm: 0, family: 'text' },
  /** Quiet labels. */
  label: { size: 13, lineHeight: 18, weight: '500', trackingEm: 0.01, family: 'text' },
  caption: { size: 12, lineHeight: 16, weight: '400', trackingEm: 0.02, family: 'text' },
  /** Capital kicker — used very sparingly, all-caps wide-spaced. */
  kicker: { size: 10, lineHeight: 12, weight: '600', trackingEm: 0.18, family: 'text' },
  /** Tabular numerics. */
  monoData: { size: 14, lineHeight: 20, weight: '500', trackingEm: 0, family: 'mono' },
};

export type TypoVariant = keyof typeof typography;
