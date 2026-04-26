import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, space, typography } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
}: Props) {
  const style = STYLES[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        style.container,
        pressed && !isDisabled && style.pressed,
        isDisabled && styles.disabled,
      ]}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={style.spinner} />
        </View>
      ) : (
        <Text style={[styles.label, style.label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.bodyEm, fontWeight: '600' },
});

const STYLES: Record<Variant, { container: object; pressed: object; label: object; spinner: string }> = {
  primary: {
    container: { backgroundColor: palette.accent },
    pressed: { backgroundColor: palette.accentPressed },
    label: { color: palette.textInverse },
    spinner: palette.textInverse,
  },
  secondary: {
    container: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    pressed: { backgroundColor: palette.surfaceAlt },
    label: { color: palette.textPrimary },
    spinner: palette.textPrimary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: palette.surface },
    label: { color: palette.textSecondary },
    spinner: palette.textSecondary,
  },
  danger: {
    container: { backgroundColor: palette.danger },
    pressed: { backgroundColor: '#A8523E' },
    label: { color: palette.textInverse },
    spinner: palette.textInverse,
  },
};
