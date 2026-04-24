import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, EmptyState, Badge } from '../../components/ui';
import { incomesApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatMoneyByLocale } from '../../utils/format';

export function IncomeScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['incomes'], queryFn: () => incomesApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.income')}
      </Text>
      {(q.data ?? []).length === 0 ? (
        <EmptyState title={t('incomes.empty.title')} description={t('incomes.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {(q.data ?? []).map((i) => (
            <Card key={i.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{i.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {i.category ?? t('common.uncategorized')} · {formatDateByLocale(i.incomeDate, { weekday: undefined })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Text style={[typography.bodyStrong, { color: colors.success }]}>
                    + {formatMoneyByLocale(i.amount)}
                  </Text>
                  {i.isRecurring ? <Badge tone="neutral">{t('incomes.recurring')}</Badge> : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
