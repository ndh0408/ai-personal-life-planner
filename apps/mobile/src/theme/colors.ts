/**
 * Round 22 — "Editorial Calm" palette.
 *
 * The original LifeOS AI palette leaned on indigo/violet — a generic
 * SaaS gradient that did nothing to differentiate a personal-life OS
 * from any other dashboard. Round 22 replaces it with a warm, paper-
 * leaning palette inspired by leather-bound journals and Swiss design
 * studios:
 *
 *   - cream paper (`#FAF6EE`) instead of cool grey-white
 *   - ink charcoal (`#211D17`) instead of navy
 *   - burnt sienna (`#C45A2D`) primary instead of indigo
 *   - sage moss (`#7A8B6B`) for success — the green of a fern, not a
 *     traffic light
 *   - saffron (`#D4A04A`) for warnings — warm gold, not hazard yellow
 *   - faded crimson (`#A8392E`) for danger — bookbinder red
 *   - linen surfaces and warm taupe muted text
 *
 * The dark theme inverts to a deep coffee-ground charcoal with
 * candlelit accents so the same emotional tone reads at night.
 */
export const palette = {
  // primary — burnt sienna / clay
  sienna500: '#C45A2D',
  sienna600: '#A84920',
  sienna400: '#D87650',

  // backgrounds
  cream50: '#FAF6EE',
  cream100: '#F2EBDB',
  linen200: '#EDE5D3',
  linen300: '#E0D5BC',

  // ink / text
  ink900: '#211D17',
  ink700: '#3A322A',
  ink500: '#5A4F42',
  taupe500: '#9C8E78',
  taupe300: '#C8BCA4',

  // dark theme companions
  espresso950: '#15110C',
  espresso900: '#1F1A14',
  espresso800: '#2B241C',
  espresso700: '#3B3128',

  // accents
  sage: '#7A8B6B',
  sageDeep: '#5C6E4F',
  saffron: '#D4A04A',
  crimson: '#A8392E',
  azurite: '#3D6E8C',
};

export const lightTheme = {
  bg: palette.cream50,
  bgElevated: '#FFFCF6',
  surface: '#FFFCF6',
  surfaceMuted: palette.cream100,
  border: palette.linen300,
  text: palette.ink900,
  textMuted: palette.taupe500,
  textInverse: palette.cream50,
  primary: palette.sienna500,
  primaryStrong: palette.sienna600,
  success: palette.sage,
  warning: palette.saffron,
  danger: palette.crimson,
  info: palette.azurite,
  overlay: 'rgba(33, 29, 23, 0.55)',
};

export const darkTheme: typeof lightTheme = {
  bg: palette.espresso950,
  bgElevated: palette.espresso900,
  surface: palette.espresso800,
  surfaceMuted: palette.espresso700,
  border: '#4A3F32',
  text: palette.cream50,
  textMuted: palette.taupe300,
  textInverse: palette.ink900,
  primary: palette.sienna400,
  primaryStrong: palette.sienna500,
  success: palette.sage,
  warning: palette.saffron,
  danger: '#D45040',
  info: '#6FA0BD',
  overlay: 'rgba(0, 0, 0, 0.62)',
};

export type ThemeColors = typeof lightTheme;
