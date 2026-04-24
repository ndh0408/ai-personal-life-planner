import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, ProgressCard, Loading, ErrorView, EmptyState } from '../../components/ui';
import { savingGoalsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatMoneyByLocale } from '../../utils/format';

export function SavingGoalsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['saving-goals'], queryFn: () => savingGoalsApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.savingGoals')}
      </Text>
      {items.length === 0 ? (
        <EmptyState title={t('savings.empty.title')} description={t('savings.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((g) => (
            <ProgressCard
              key={g.id}
              title={g.title}
              current={Number(g.currentAmount)}
              target={Number(g.targetAmount)}
              currentLabel={`${formatMoneyByLocale(g.currentAmount)} / ${formatMoneyByLocale(g.targetAmount)}`}
              subtitle={
                g.targetDate
                  ? `${t('savings.targetDate')}: ${formatDateByLocale(g.targetDate, { weekday: undefined })}`
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
