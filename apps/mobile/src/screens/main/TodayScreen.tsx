import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppScreen, EmptyState, Text } from '../../components/ui';
import { spacing } from '../../theme';

export function TodayScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.today')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('today.title')}
      </Text>
      <EmptyState title={t('today.empty')} />
    </AppScreen>
  );
}
