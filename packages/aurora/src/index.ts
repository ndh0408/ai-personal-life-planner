export {
  moments,
  momentForHour,
  status,
  kind,
  type Moment,
  type MomentPalette,
} from './palette';
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

import { moments } from './palette';
import { fontFamily, typography } from './typography';
import { space, radius, hitSize, screenEdge } from './space';
import { duration, easing, spring, stagger } from './motion';

export const aurora = {
  moments,
  fontFamily,
  typography,
  space,
  radius,
  hitSize,
  screenEdge,
  motion: { duration, easing, spring, stagger },
} as const;
export type Aurora = typeof aurora;
