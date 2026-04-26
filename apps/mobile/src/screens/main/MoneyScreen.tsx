import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppScreen,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  Text,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useExpensesSummary, useWeekExpenses } from '../../hooks/useFeed';
import type { ExpenseRow } from '../../services/api/finance.service';
import { formatMoney, relativeTime } from '../../utils/format';

export function MoneyScreen() {
  const { t, i18n } = useTranslation();
  const summary = useExpensesSummary();
  const week = useWeekExpenses();

  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.money')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('money.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
        <StatCard
          label={t('money.todayTotal')}
          value={formatMoney(summary.data?.todayTotal ?? 0)}
        />
        <StatCard
          label={t('money.weekTotal')}
          value={formatMoney(summary.data?.weekTotal ?? 0)}
        />
      </View>

      {summary.data && summary.data.weekByCategory.length > 0 ? (
        <Card style={{ marginBottom: spacing.xl }}>
          <Text variant="kicker">By category</Text>
          {summary.data.weekByCategory.map((c) => (
            <View
              key={c.category}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Text>{c.category}</Text>
              <Text variant="bodyEm">{formatMoney(c.amount)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('money.weekTotal')}
      </Text>

      {week.isError ? <ErrorState onRetry={() => week.refetch()} /> : null}
      {week.isLoading ? <LoadingState /> : null}
      {week.data && week.data.rows.length === 0 ? <EmptyState title={t('money.empty')} /> : null}

      <View style={{ gap: spacing.md }}>
        {week.data?.rows.map((r) => (
          <ExpenseCard key={r.id} row={r} locale={i18n.language as 'vi' | 'en'} />
        ))}
      </View>
    </AppScreen>
  );
}

function ExpenseCard({ row, locale }: { row: ExpenseRow; locale: 'vi' | 'en' }) {
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="bodyEm">{row.title}</Text>
          <Text variant="caption">
            {row.category} · {relativeTime(row.expenseDate, locale)}
          </Text>
        </View>
        <Text variant="bodyEm">{formatMoney(row.amount)}</Text>
      </View>
    </Card>
  );
}
