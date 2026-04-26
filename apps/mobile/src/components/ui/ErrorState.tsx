import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';
import { useTranslation } from 'react-i18next';

interface Props {
  title?: string;
  body?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, body, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title ?? t('common.errorTitle')}</Text>
      <Text style={styles.body}>{body ?? t('common.errorBody')}</Text>
      {onRetry ? (
        <View style={styles.cta}>
          <Button label={t('common.retry')} onPress={onRetry} variant="secondary" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing['2xl'], gap: spacing.sm },
  title: { ...typography.heading, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
  cta: { marginTop: spacing.md },
});
