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
  const { colors, radius, spacing } = useTheme();
  const padV = size === 'lg' ? spacing.md + 2 : size === 'sm' ? spacing.sm : spacing.md;
  const padH = size === 'lg' ? spacing.xl : size === 'sm' ? spacing.md : spacing.lg;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;

  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surfaceMuted, fg: colors.text, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: colors.primary, border: 'transparent' };
      case 'danger':
        return { bg: colors.danger, fg: '#FFFFFF', border: colors.danger };
      default:
        return { bg: colors.primary, fg: '#FFFFFF', border: colors.primary };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.md,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={{ marginRight: 6 }}>{leftIcon}</View> : null}
          <Text style={{ color: palette.fg, fontSize, fontWeight: '600' }}>{title}</Text>
          {rightIcon ? <View style={{ marginLeft: 6 }}>{rightIcon}</View> : null}
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
