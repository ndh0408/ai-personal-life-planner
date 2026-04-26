export { colors, type Color } from './colors';
export { spacing, type Spacing } from './spacing';
export { radius, type Radius } from './radius';
export { typography, type TypoVariant } from './typography';
export { shadows, type Shadow } from './shadows';

import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { shadows } from './shadows';

/** One-stop bag for ad-hoc styling (when StyleSheet would be overkill). */
export const theme = { colors, spacing, radius, typography, shadows } as const;
export type Theme = typeof theme;
