import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: Props) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: selected ? colors.primary : colors.surfaceMuted,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
