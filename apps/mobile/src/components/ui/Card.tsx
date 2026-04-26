import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  /**
   * "Editorial" hairline accent — a single thin sienna line along the
   * top edge of the card, the way a magazine pull-quote announces
   * itself. Reserved for hero / featured surfaces.
   * Round 22 / Editorial Calm.
   */
  accent?: 'top' | 'left' | 'none';
  style?: ViewStyle;
};

/**
 * Surface card. Round 22 swaps the cool grey border for a warm linen
 * tint and uses the new shadow tokens (warm sienna ink instead of
 * pure black) so cards read as paper rather than glass.
 */
export function Card({
  padded = true,
  elevated = false,
  accent = 'none',
  style,
  children,
  ...rest
}: Props) {
  const { colors, radius, spacing, shadows } = useTheme();
  const shadow = elevated ? shadows.level2 : shadows.level1;
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: elevated ? colors.bgElevated : colors.surface,
          borderRadius: radius.lg,
          padding: padded ? spacing.lg : 0,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        shadow,
        style,
      ]}
    >
      {accent === 'top' ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      {accent === 'left' ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}
