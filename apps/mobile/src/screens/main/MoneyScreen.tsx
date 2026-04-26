import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppScreen, EmptyState, StatCard, Text } from '../../components/ui';
import { spacing } from '../../theme';

export function MoneyScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.money')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('money.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
        <StatCard label={t('money.todayTotal')} value="0₫" hint="—" />
        <StatCard label={t('money.weekTotal')} value="0₫" hint="—" />
      </View>

      <EmptyState title={t('money.empty')} />
    </AppScreen>
  );
}
