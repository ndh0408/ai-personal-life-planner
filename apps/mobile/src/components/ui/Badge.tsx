import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type Props = { tone?: Tone; children: React.ReactNode; style?: ViewStyle };

export function Badge({ tone = 'neutral', children, style }: Props) {
  const { colors, radius, spacing } = useTheme();
  const palette = (() => {
    switch (tone) {
      case 'primary':
        return { bg: colors.primary + '22', fg: colors.primary };
      case 'success':
        return { bg: colors.success + '22', fg: colors.success };
      case 'warning':
        return { bg: colors.warning + '22', fg: colors.warning };
      case 'danger':
        return { bg: colors.danger + '22', fg: colors.danger };
      case 'info':
        return { bg: colors.info + '22', fg: colors.info };
      default:
        return { bg: colors.surfaceMuted, fg: colors.textMuted };
    }
  })();
  return (
    <View
      style={[
        {
          backgroundColor: palette.bg,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}
