import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

const ios = (opacity: number, radius: number, offsetY: number): ViewStyle => ({
  shadowColor: '#000',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: offsetY },
});
const android = (elevation: number): ViewStyle => ({ elevation });

/**
 * Use sparingly — Editorial Calm prefers a 1px border over a drop shadow for
 * card elevation. These are reserved for true overlays (sheets, modals, toasts).
 */
export const shadows = {
  none: {} as ViewStyle,
  sm: Platform.select({ ios: ios(0.18, 6, 2), android: android(2) }) as ViewStyle,
  md: Platform.select({ ios: ios(0.24, 12, 4), android: android(6) }) as ViewStyle,
  lg: Platform.select({ ios: ios(0.32, 24, 12), android: android(12) }) as ViewStyle,
} as const;

export type Shadow = keyof typeof shadows;
