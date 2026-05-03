import { useMemo } from 'react';
import { Easing } from 'react-native-reanimated';
import { duration, easing as easingTokens, spring as springTokens } from '@lifeos/design-tokens';

/**
 * Reanimated-bound motion helpers. Token shape stays platform-neutral in
 * @lifeos/design-tokens; this module is the RN binding.
 */

export type Motion = {
  duration: typeof duration;
  spring: typeof springTokens;
  /** Reanimated-ready easing functions, pre-built from the token control points. */
  easing: {
    emphasized: ReturnType<typeof Easing.bezier>;
    standard: ReturnType<typeof Easing.bezier>;
    decelerate: ReturnType<typeof Easing.bezier>;
    accelerate: ReturnType<typeof Easing.bezier>;
  };
};

export function useMotion(): Motion {
  return useMemo(
    () => ({
      duration,
      spring: springTokens,
      easing: {
        emphasized: Easing.bezier(...easingTokens.emphasized),
        standard: Easing.bezier(...easingTokens.standard),
        decelerate: Easing.bezier(...easingTokens.decelerate),
        accelerate: Easing.bezier(...easingTokens.accelerate),
      },
    }),
    [],
  );
}
