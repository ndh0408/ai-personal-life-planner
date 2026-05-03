import { Platform, type ViewStyle } from 'react-native';
import { elevation, type ElevationLevel } from '@lifeos/design-tokens';

/**
 * Build an elevation ViewStyle for the given level. iOS uses shadow*; Android
 * uses elevation. Shadow color is locked to black; warm-dark canvas keeps it
 * looking right.
 */
export function elevationStyle(level: ElevationLevel): ViewStyle {
  const e = elevation[level];
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: e.iosOpacity,
      shadowRadius: e.iosRadius,
      shadowOffset: { width: 0, height: e.iosOffsetY },
    },
    android: { elevation: e.androidElevation },
    default: {},
  })!;
}
