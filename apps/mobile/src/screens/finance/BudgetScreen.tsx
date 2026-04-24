import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, ProgressCard, Loading, ErrorView, EmptyState , Button } from '../../components/ui';
import { budgetsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale } from '../../utils/format';

export function BudgetScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['budgets'], queryFn: () => budgetsApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.budget')}
      </Text>
      {items.length === 0 ? (
        <EmptyState title={t('budgets.empty.title')} description={t('budgets.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((b) => (
            <ProgressCard
              key={b.id}
              title={b.category}
              current={b.usage.spent}
              target={Number(b.amount)}
              currentLabel={`${formatMoneyByLocale(b.usage.spent)} (${b.usage.usedPercent}%)`}
              subtitle={`${t('budgets.period')}: ${b.period} · ${t('budgets.threshold')}: ${b.alertThresholdPercent}%`}
              tone={
                b.usage.usedPercent >= 100
                  ? 'danger'
                  : b.usage.overThreshold
                    ? 'warning'
                    : 'default'
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
