import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export function Loading({ label }: { label?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <ActivityIndicator color={colors.primary} />
      {label ? (
        <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>{label}</Text>
      ) : null}
    </View>
  );
}
