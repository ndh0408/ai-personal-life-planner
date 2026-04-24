import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from './Button';

type Props = { message: string; onRetry?: () => void };

export function ErrorView({ message, onRetry }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.danger, marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.textMuted,
          textAlign: 'center',
          marginBottom: spacing.lg,
        }}
      >
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
