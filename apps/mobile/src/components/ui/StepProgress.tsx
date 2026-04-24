import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

type Props = { total: number; current: number };

/**
 * Segmented horizontal progress bar used across onboarding. `current` is
 * 1-based; the filled count matches it.
 */
export function StepProgress({ total, current }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg }}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < current;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: filled ? colors.primary : colors.surfaceMuted,
            }}
          />
        );
      })}
    </View>
  );
}
