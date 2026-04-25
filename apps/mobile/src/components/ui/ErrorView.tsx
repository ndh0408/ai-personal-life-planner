import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Button } from './Button';

type Props = { message: string; onRetry?: () => void };

export function ErrorView({ message, onRetry }: Props) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.danger, marginBottom: 8 }}>
        {t('errors.UNKNOWN_ERROR')}
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
      {onRetry ? <Button title={t('common.tryAgain')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
