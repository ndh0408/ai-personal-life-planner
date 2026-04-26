import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Primary CTA. Round 22 — switches the label to Plus Jakarta Sans
 * Semibold with a small uppercase tracking lift on `lg` so the
 * button reads as deliberate, the way a magazine pull-quote button
 * would. Press scales 0.985 (sub-pixel feedback rather than the
 * usual aggressive 0.95).
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  fullWidth,
  leftIcon,
  rightIcon,
  style,
  ...rest
}: Props) {
  const { colors, radius, spacing, fonts } = useTheme();
  const padV = size === 'lg' ? spacing.md + 4 : size === 'sm' ? spacing.sm : spacing.md;
  const padH = size === 'lg' ? spacing.xl : size === 'sm' ? spacing.md : spacing.lg;
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 14;
  const letterSpacing = size === 'lg' ? 0.4 : 0.2;

  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surfaceMuted, fg: colors.text, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: colors.primary, border: 'transparent' };
      case 'danger':
        return { bg: colors.danger, fg: colors.textInverse, border: colors.danger };
      default:
        return { bg: colors.primary, fg: colors.textInverse, border: colors.primary };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={(state: { pressed: boolean }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.md + 2,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
          transform: state.pressed && !isDisabled ? [{ scale: 0.985 }] : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
          <Text
            style={{
              color: palette.fg,
              fontFamily: fonts.sansSemibold,
              fontSize,
              letterSpacing,
            }}
          >
            {title}
          </Text>
          {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center' },
});
