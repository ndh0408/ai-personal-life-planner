import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

type Props = {
  tone?: Tone;
  children: React.ReactNode;
  /**
   * Editorial mode — small caps tracked label paired with a tiny
   * leading dot in the tone colour. Used on the Dashboard status
   * chip ("• SẴN SÀNG"). Round 22.
   */
  variant?: 'fill' | 'editorial';
  style?: ViewStyle;
};

/**
 * Status / category pill. Round 22 introduces an "editorial" variant
 * that ditches the filled pill for a tracked-out small-caps label
 * with a leading dot, the way magazines mark column kickers.
 */
export function Badge({ tone = 'neutral', variant = 'fill', children, style }: Props) {
  const { colors, radius, spacing, fonts, typography } = useTheme();

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

  if (variant === 'editorial') {
    return (
      <View
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
          style,
        ]}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: palette.fg,
          }}
        />
        <Text style={[typography.eyebrow, { color: palette.fg }]}>{children}</Text>
      </View>
    );
  }

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
      <Text
        style={{
          color: palette.fg,
          fontFamily: fonts.sansSemibold,
          fontSize: 11,
          letterSpacing: 0.4,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
