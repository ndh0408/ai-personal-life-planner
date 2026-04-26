import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { useTranslation } from 'react-i18next';

interface Props {
  label?: string;
  inline?: boolean;
}

export function LoadingState({ label, inline = false }: Props) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, inline && styles.inline]}>
      <ActivityIndicator color={colors.accent.base} />
      <Text style={styles.label}>{label ?? t('common.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inline: { paddingVertical: spacing.md, flexDirection: 'row' },
  label: { ...typography.caption, color: colors.text.muted },
});
