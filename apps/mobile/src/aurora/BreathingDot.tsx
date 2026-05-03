import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAurora } from './AuroraProvider';

interface Props {
  size?: number;
  color?: string;
  /** Disable for reduced-motion / tests. */
  motion?: boolean;
}

/**
 * Tiny breathing pulse — used as a "live" indicator next to the assistant
 * status, capture-listening state, etc. 4.8s cycle (matches the canvas
 * drift period for sympathetic motion).
 */
export function BreathingDot({ size = 8, color, motion = true }: Props) {
  const t = useAurora();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (!motion) return;
    scale.value = withRepeat(
      withTiming(1.5, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.95, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [motion, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - opacity.value + 0.05,
  }));

  const c = color ?? t.palette.accent;

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: c,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c,
        }}
      />
    </View>
  );
}
