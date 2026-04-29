export { colors, type Color } from './colors';
export { spacing, type Spacing } from './spacing';
export { radius, type Radius } from './radius';
export { typography, type TypoVariant } from './typography';
export { shadows, type Shadow } from './shadows';
export { tokens, type Tokens, type ToneName, type KindName } from './tokens';

import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { shadows } from './shadows';
import { tokens } from './tokens';

/** One-stop bag for ad-hoc styling (when StyleSheet would be overkill). */
export const theme = { colors, spacing, radius, typography, shadows, tokens } as const;
export type Theme = typeof theme;
