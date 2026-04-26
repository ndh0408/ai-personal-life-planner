import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  emphasis?: 'default' | 'elevated';
}

export function Card({ children, onPress, style, emphasis = 'default' }: Props) {
  const baseStyle = [styles.card, emphasis === 'elevated' && styles.elevated, style];
  if (!onPress) return <View style={baseStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
      style={({ pressed }) => [...baseStyle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  elevated: { backgroundColor: colors.surfaceAlt },
  pressed: { backgroundColor: colors.surfaceAlt },
});
