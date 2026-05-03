import React from 'react';
import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useAurora } from './AuroraProvider';
import { FlowText } from './FlowText';
import { haptic } from '../platform/haptics';

type Variant = 'primary' | 'glass' | 'ghost';

interface Props {
  label: string;
  variant?: Variant;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Gradient button — primary form fills with a moment-tinted gradient stripe,
 * glass form is a frosted pane, ghost is text-only.
 *
 * Spring-snappy press scale; haptic confirm on press.
 */
export function GradientButton({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  style,
  testID,
}: Props) {
  const t = useAurora();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = () => {
    if (disabled) return;
    haptic('confirm');
    scale.value = withSpring(0.95, t.motion.spring.snappy, () => {
      scale.value = withSpring(1, t.motion.spring.snappy);
    });
    onPress?.();
  };

  const HEIGHT = 56;

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        testID={testID}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {variant === 'primary' ? (
          <View
            style={{
              height: HEIGHT,
              borderRadius: t.radius.xl,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id="gbtn" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={t.palette.accentGlow} stopOpacity="1" />
                  <Stop offset="1" stopColor={t.palette.accent} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#gbtn)" />
            </Svg>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 18,
                right: 18,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.45)',
              }}
            />
            <FlowText variant="titleM" tone="inverse">
              {label}
            </FlowText>
          </View>
        ) : variant === 'glass' ? (
          <View
            style={{
              height: HEIGHT,
              borderRadius: t.radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.palette.glassTint,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <FlowText variant="titleM" tone="primary">
              {label}
            </FlowText>
          </View>
        ) : (
          <View
            style={{
              height: HEIGHT,
              borderRadius: t.radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FlowText variant="titleM" tone="accent">
              {label}
            </FlowText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
