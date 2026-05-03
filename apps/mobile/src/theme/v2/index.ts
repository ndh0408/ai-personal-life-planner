/**
 * Theme v2 — bridges @lifeos/design-tokens into the React Native runtime.
 *
 * v1 (`apps/mobile/src/theme/index.ts`) stays put: 19+ rounds of components
 * import it. v2 is the canonical entry for new components going forward.
 * v1 will be re-skinned to read from design-tokens in a follow-up round so
 * existing code automatically benefits.
 */
export { ThemeProvider, useTheme, useColorScheme } from './ThemeProvider';
export { resolveFontFamily, makeTextStyle, type TextVariant } from './typography';
export { useMotion, type Motion } from './motion';
export { elevationStyle } from './elevation';
export type { Theme } from './ThemeProvider';
