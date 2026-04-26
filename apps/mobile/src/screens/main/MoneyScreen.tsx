import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  Text,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useExpensesSummary, useWeekExpenses } from '../../hooks/useFeed';
import { financeService, type ExpenseRow } from '../../services/api/finance.service';
import { formatMoney, relativeTime } from '../../utils/format';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Money'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function MoneyScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const summary = useExpensesSummary();
  const week = useWeekExpenses();
  const [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => financeService.remove(id),
    onSuccess: () => {
      toast.show(t('common.deleted'), 'success');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const refreshing = (week.isFetching && !week.isLoading) || (summary.isFetching && !summary.isLoading);
  const onRefresh = () => {
    void week.refetch();
    void summary.refetch();
  };

  return (
    <AppScreen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text variant="kicker">{t('tabs.money')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('money.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
        <StatCard label={t('money.todayTotal')} value={formatMoney(summary.data?.todayTotal ?? 0)} />
        <StatCard label={t('money.weekTotal')} value={formatMoney(summary.data?.weekTotal ?? 0)} />
      </View>

      <Button label={'+ ' + t('money.addCta')} onPress={() => navigation.navigate('AddExpense')} />

      <View style={{ height: spacing.xl }} />

      {summary.data && summary.data.weekByCategory.length > 0 ? (
        <Card style={{ marginBottom: spacing.xl }}>
          <Text variant="kicker">{t('money.byCategory')}</Text>
          {summary.data.weekByCategory.map((c) => (
            <View
              key={c.category}
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <Text>{t(`money.categories.${c.category}`, { defaultValue: c.category })}</Text>
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
          <ExpenseCard
            key={r.id}
            row={r}
            locale={i18n.language as 'vi' | 'en'}
            onDelete={() => setPendingDelete(r)}
          />
        ))}
      </View>

      <ConfirmModal
        visible={!!pendingDelete}
        title={t('money.confirmDeleteTitle')}
        body={pendingDelete?.title}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </AppScreen>
  );
}

function ExpenseCard({
  row,
  locale,
  onDelete,
}: {
  row: ExpenseRow;
  locale: 'vi' | 'en';
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="bodyEm">{row.title}</Text>
          <Text variant="caption">
            {t(`money.categories.${row.category}`, { defaultValue: row.category })} ·{' '}
            {relativeTime(row.expenseDate, locale)}
          </Text>
        </View>
        <Text variant="bodyEm">{formatMoney(row.amount)}</Text>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Button label={t('common.delete')} variant="ghost" onPress={onDelete} size="md" />
      </View>
    </Card>
  );
}
