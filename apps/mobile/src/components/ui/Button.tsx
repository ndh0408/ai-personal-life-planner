import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
}: Props) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [
        styles.base,
        s.container,
        fullWidth && styles.full,
        v.container,
        pressed && !isDisabled && v.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={v.spinner} size="small" />
        </View>
      ) : (
        <Text style={[styles.label, s.label, v.label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', textAlign: 'center' },
});

const SIZES = {
  md: {
    container: { paddingVertical: 14, paddingHorizontal: spacing.xl, minHeight: 48 },
    label: { ...typography.body, fontWeight: '600' as const },
  },
  lg: {
    container: { paddingVertical: 18, paddingHorizontal: spacing.xl, minHeight: 56 },
    label: { ...typography.heading },
  },
} as const;

const VARIANTS: Record<
  Variant,
  { container: object; pressed: object; label: object; spinner: string }
> = {
  primary: {
    container: { backgroundColor: colors.accent.base },
    pressed: { backgroundColor: colors.accent.pressed },
    label: { color: colors.text.inverse },
    spinner: colors.text.inverse,
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    pressed: { backgroundColor: colors.surfaceAlt },
    label: { color: colors.text.primary },
    spinner: colors.text.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surface },
    label: { color: colors.text.secondary },
    spinner: colors.text.secondary,
  },
  danger: {
    container: { backgroundColor: colors.status.danger },
    pressed: { backgroundColor: '#A8523E' },
    label: { color: colors.text.inverse },
    spinner: colors.text.inverse,
  },
};
