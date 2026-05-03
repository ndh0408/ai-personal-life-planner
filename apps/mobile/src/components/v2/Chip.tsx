import React from 'react';
import { Pressable, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/v2';
import { useMotion } from '../../theme/v2/motion';
import { Text } from './Text';
import { haptic } from '../../platform/haptics';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional accent override for kind-coloured chips (e.g. EXPENSE = clay). */
  accent?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Selectable chip. Spring-snappy on press. When `selected`, fill with
 * `accent` (or the theme accent) at low alpha + emphasized stroke.
 */
export function Chip({ label, selected = false, onPress, accent, style, testID }: Props) {
  const t = useTheme();
  const motion = useMotion();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const tone = accent ?? t.color.accent.base;
  const bg = selected ? `${tone}26` /* ~15% alpha */ : t.color.bg.surface;
  const border = selected ? tone : t.color.border.base;
  const fg = selected ? tone : t.color.text.secondary;

  const handle = () => {
    haptic('selection');
    scale.value = withSpring(0.94, motion.spring.snappy, () => {
      scale.value = withSpring(1, motion.spring.snappy);
    });
    onPress?.();
  };

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={handle}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[
          {
            paddingHorizontal: t.space['3'],
            paddingVertical: t.space['2'],
            borderRadius: t.radius.pill,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: bg,
            minHeight: 36,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Text variant="caption" style={{ color: fg }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
