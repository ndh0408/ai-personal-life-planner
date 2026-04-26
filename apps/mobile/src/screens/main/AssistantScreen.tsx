import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppScreen, EmptyState, Text } from '../../components/ui';
import { spacing } from '../../theme';

export function AssistantScreen() {
  const { t } = useTranslation();
  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.assistant')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('assistant.title')}
      </Text>
      <EmptyState title={t('assistant.empty')} />
    </AppScreen>
  );
}
