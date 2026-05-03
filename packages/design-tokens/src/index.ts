export {
  palette,
  colorDark,
  colorLight,
  colorByScheme,
  type ColorTokens,
  type ColorScheme,
} from './color';
export { fontFamily, typography, type FontStyle, type TypoVariant } from './typography';
export { space, radius, hitSize, screenEdge, type Space, type Radius } from './space';
export {
  duration,
  easing,
  spring,
  stagger,
  type Duration,
  type Easing,
  type Spring,
  type Stagger,
} from './motion';
export { elevation, type ElevationToken, type ElevationLevel } from './elevation';

import { colorByScheme } from './color';
import { fontFamily, typography } from './typography';
import { space, radius, hitSize, screenEdge } from './space';
import { duration, easing, spring, stagger } from './motion';
import { elevation } from './elevation';

/** Full token bag. Mobile theme provider builds from this. */
export const tokens = {
  color: colorByScheme,
  fontFamily,
  typography,
  space,
  radius,
  hitSize,
  screenEdge,
  motion: { duration, easing, spring, stagger },
  elevation,
} as const;

export type Tokens = typeof tokens;
