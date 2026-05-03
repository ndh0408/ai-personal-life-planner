import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/v2';
import { useMotion } from '../../theme/v2/motion';
import { elevationStyle } from '../../theme/v2/elevation';
import { haptic } from '../../platform/haptics';

interface Props {
  onPress: () => void;
  /** Tab bar height — used to lift FAB above the bar. */
  tabBarHeight?: number;
  testID?: string;
}

/**
 * The omnipresent capture button. Sits above the tab bar, slightly inset.
 * Pressing fires `confirm` haptic + `onPress`. Visual: gold accent disc with
 * a 14px gap. NEVER moves, NEVER hides — the user must always be able to
 * capture in one tap.
 */
export function FloatingCaptureButton({ onPress, tabBarHeight = 64, testID }: Props) {
  const t = useTheme();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handle = () => {
    haptic('confirm');
    scale.value = withSpring(0.92, motion.spring.snappy, () => {
      scale.value = withSpring(1, motion.spring.snappy);
    });
    onPress();
  };

  // Position above the tab bar plus safe-area bottom plus an 18pt visual gap.
  const bottom = tabBarHeight + insets.bottom + 18;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          right: 20,
          bottom,
        },
        animated,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handle}
        accessibilityLabel="Quick capture"
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: t.color.accent.base,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.92 : 1,
            ...elevationStyle('floating'),
          },
        ]}
      >
        <View
          style={{
            width: 22,
            height: 22,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Plus glyph drawn with two crossed bars — keeps icon font out of
              the critical render path so the FAB renders even before icons load. */}
          <View
            style={{
              position: 'absolute',
              width: 18,
              height: 2.5,
              backgroundColor: t.color.text.onAccent,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 2.5,
              height: 18,
              backgroundColor: t.color.text.onAccent,
              borderRadius: 2,
            }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}
