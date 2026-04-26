import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface Props {
  /** Number of skeleton lines inside the card. */
  lines?: number;
  /** Render a header bar above the lines. */
  header?: boolean;
}

export function SkeletonCard({ lines = 2, header = true }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      {header ? <Animated.View style={[styles.header, { opacity }]} /> : null}
      <View style={{ gap: spacing.sm }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Animated.View
            key={i}
            style={[styles.line, { opacity, width: i === lines - 1 ? '60%' : '100%' }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { height: 14, width: '40%', borderRadius: radius.sm, backgroundColor: colors.surfaceLifted },
  line: { height: 12, borderRadius: radius.sm, backgroundColor: colors.surfaceLifted },
});
