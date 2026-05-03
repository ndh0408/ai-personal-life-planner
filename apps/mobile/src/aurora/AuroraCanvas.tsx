import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, LinearGradient } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAurora } from './AuroraProvider';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Disable the slow background drift (useful for tests / reduced motion). */
  motion?: boolean;
}

/**
 * Living mesh-gradient canvas. Two radial gradients drift in opposite
 * directions on a long cycle (16s) — never abrupt, just enough to feel
 * alive. SVG renders the gradient; the drift is a subtle translate +
 * scale on the SVG itself.
 *
 * The canvas reads its colors from the active moment palette. Time-of-day
 * shifts arrive automatically when `<AuroraProvider>` recomputes the moment.
 */
export function AuroraCanvas({ children, style, motion = true }: Props) {
  const t = useAurora();
  const drift = useSharedValue(0);

  React.useEffect(() => {
    if (!motion) return;
    drift.value = 0;
    drift.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [motion, drift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -20 + drift.value * 40 },
      { translateY: -10 + drift.value * 20 },
      { scale: 1 + drift.value * 0.06 },
    ],
  }));

  return (
    <View style={[{ flex: 1, backgroundColor: t.palette.canvasA }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="auroraTop" cx="20%" cy="0%" r="80%">
              <Stop offset="0" stopColor={t.palette.accent} stopOpacity="0.32" />
              <Stop offset="1" stopColor={t.palette.canvasA} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="auroraBottom" cx="100%" cy="120%" r="100%">
              <Stop offset="0" stopColor={t.palette.canvasB} stopOpacity="1" />
              <Stop offset="1" stopColor={t.palette.canvasA} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="auroraVeil" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.palette.canvasA} stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.18" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={t.palette.canvasA} />
          <Rect width="100%" height="100%" fill="url(#auroraBottom)" />
          <Rect width="100%" height="100%" fill="url(#auroraTop)" />
          <Rect width="100%" height="100%" fill="url(#auroraVeil)" />
        </Svg>
      </Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
