import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'accent';
}

export function Chip({ label, selected = false, onPress, tone = 'neutral' }: Props) {
  const palette = selected ? STYLES[tone].selected : STYLES[tone].rest;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, palette.container, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.85 },
  label: { ...typography.caption, fontWeight: '600' },
});

const STYLES = {
  neutral: {
    rest: {
      container: { backgroundColor: colors.surface, borderColor: colors.border },
      label: colors.text.secondary,
    },
    selected: {
      container: { backgroundColor: colors.surfaceLifted, borderColor: colors.borderStrong },
      label: colors.text.primary,
    },
  },
  accent: {
    rest: {
      container: { backgroundColor: colors.accent.soft, borderColor: 'transparent' },
      label: colors.accent.base,
    },
    selected: {
      container: { backgroundColor: colors.accent.base, borderColor: colors.accent.base },
      label: colors.text.inverse,
    },
  },
} as const;
