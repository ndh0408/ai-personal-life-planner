import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Badge, Loading, ErrorView, EmptyState } from '../../components/ui';
import { debtsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatMoneyByLocale } from '../../utils/format';

export function DebtScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const q = useQuery({ queryKey: ['debts'], queryFn: () => debtsApi.list() });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
        {t('nav.debt')}
      </Text>
      {items.length === 0 ? (
        <EmptyState title={t('debts.empty.title')} description={t('debts.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((d) => {
            const remaining = Number(d.totalAmount) - Number(d.paidAmount);
            const tone = d.type === 'I_OWE' ? colors.warning : colors.success;
            return (
              <Card key={d.id}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Badge tone="neutral">{d.type === 'I_OWE' ? t('debts.iOwe') : t('debts.owedToMe')}</Badge>
                  <Badge tone={d.status === 'PAID' ? 'neutral' : 'warning'}>{d.status}</Badge>
                </View>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{d.title}</Text>
                {d.personName ? (
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {d.personName}
                  </Text>
                ) : null}
                <Text style={[typography.h2, { color: tone, marginTop: spacing.sm }]}>
                  {formatMoneyByLocale(remaining)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('debts.totalWord')}: {formatMoneyByLocale(d.totalAmount)}
                  {d.dueDate
                    ? ` · ${t('debts.due')} ${formatDateByLocale(d.dueDate, { weekday: undefined })}`
                    : ''}
                </Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
