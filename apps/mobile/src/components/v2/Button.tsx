import React from 'react';
import { Pressable, ActivityIndicator, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/v2';
import { Text } from './Text';
import { haptic } from '../../platform/haptics';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props {
  label: string;
  variant?: Variant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  variant = 'primary',
  onPress,
  loading = false,
  disabled = false,
  style,
  testID,
}: Props) {
  const t = useTheme();

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return { bg: t.color.accent.base, fg: t.color.text.onAccent, border: t.color.accent.base };
      case 'danger':
        return { bg: t.color.status.danger.bg, fg: t.color.status.danger.fg, border: t.color.status.danger.fg };
      case 'ghost':
      default:
        return { bg: 'transparent', fg: t.color.text.primary, border: t.color.border.base };
    }
  })();

  const isOff = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        if (isOff) return;
        haptic('confirm');
        onPress?.();
      }}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading }}
      style={({ pressed }) => [
        {
          height: t.hitSize,
          paddingHorizontal: t.space['5'],
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isOff ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text variant="titleM" style={{ color: palette.fg }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
