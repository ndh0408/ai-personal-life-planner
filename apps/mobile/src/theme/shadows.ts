import type { ViewStyle } from 'react-native';

/**
 * Elevation tokens. iOS uses `shadow*` props; Android uses `elevation`.
 * The dark-mode preset drops shadows almost entirely because they read as
 * grey halos on a dark surface — we lean on `surfaceMuted` borders instead.
 */
type ShadowSet = {
  none: ViewStyle;
  level1: ViewStyle;
  level2: ViewStyle;
  level3: ViewStyle;
};

// Round 22 — warm-tinted shadows. Pure black shadows on a cream
// background read cool/grey; we cast a warm ink tone instead so cards
// look like paper resting on paper rather than glass on cement.
const SHADOW_TINT = '#3A2E1F';

const lightShadows: ShadowSet = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  level1: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  level2: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  level3: {
    shadowColor: SHADOW_TINT,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
};

const darkShadows: ShadowSet = {
  none: lightShadows.none,
  level1: { ...lightShadows.none, elevation: 1 },
  level2: { ...lightShadows.none, elevation: 2 },
  level3: { ...lightShadows.none, elevation: 4 },
};

export type ShadowToken = keyof ShadowSet;

export function getShadows(isDark: boolean): ShadowSet {
  return isDark ? darkShadows : lightShadows;
}

export type Shadows = ShadowSet;
