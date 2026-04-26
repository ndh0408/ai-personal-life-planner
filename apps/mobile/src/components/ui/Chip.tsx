import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/**
 * Pill chip. Round 22 — uses Plus Jakarta Sans Semibold + light
 * letter-spacing. When selected, fills with the primary sienna and
 * uses cream text. When unselected, sits on the linen surface with a
 * single hairline border (the way a typography sample card hugs its
 * mat).
 */
export function Chip({ label, selected, onPress, style }: Props) {
  const { colors, radius, spacing, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={(state: { pressed: boolean }) => [
        {
          backgroundColor: selected ? colors.primary : colors.surfaceMuted,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          opacity: state.pressed ? 0.85 : 1,
          transform: state.pressed ? [{ scale: 0.985 }] : undefined,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? colors.textInverse : colors.text,
          fontFamily: fonts.sansSemibold,
          fontSize: 13,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
