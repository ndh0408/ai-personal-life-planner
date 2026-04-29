import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  Text,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import {
  financeService,
  incomeService,
  type TimelineEntry,
} from '../../services/api/finance.service';
import { formatMoney, relativeTime } from '../../utils/format';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Money'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Range = 'today' | 'week' | 'month';

export function MoneyScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [range, setRange] = useState<Range>('month');
  const [pendingDelete, setPendingDelete] = useState<TimelineEntry | null>(null);

  const timeline = useQuery({
    queryKey: ['finance', 'timeline', range],
    queryFn: () => financeService.timeline(range),
  });

  const remove = useMutation({
    mutationFn: (entry: TimelineEntry) =>
      entry.kind === 'EXPENSE'
        ? financeService.remove(entry.id)
        : incomeService.remove(entry.id),
    onSuccess: () => {
      toast.show(t('common.deleted'), 'success');
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['incomes'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const refreshing = timeline.isFetching && !timeline.isLoading;
  // On phones < 360dp the two stat cards squeeze; stack vertically there.
  const { device } = useResponsive();
  const stackStats = device === 'smallPhone';

  return (
    <AppScreen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => timeline.refetch()} />
      }
    >
      <Text variant="kicker">{t('tabs.money')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        {t('money.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['today', 'week', 'month'] as Range[]).map((r) => (
          <Chip
            key={r}
            label={t(`money.ranges.${r}`)}
            tone="accent"
            selected={range === r}
            onPress={() => setRange(r)}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: stackStats ? 'column' : 'row',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <StatCard
          label={t('money.totalIncome')}
          value={'+' + formatMoney(timeline.data?.totalIncome ?? 0)}
        />
        <StatCard
          label={t('money.totalExpense')}
          value={'-' + formatMoney(timeline.data?.totalExpense ?? 0)}
        />
      </View>
      <Card
        style={{
          marginBottom: spacing.xl,
          backgroundColor: (timeline.data?.net ?? 0) >= 0 ? '#E8F5EE' : '#FBE9E7',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="kicker">{t('money.net')}</Text>
          <Text
            variant="bodyEm"
            style={{
              color: (timeline.data?.net ?? 0) >= 0 ? '#2E8B57' : '#C24A3F',
              fontSize: 18,
            }}
          >
            {(timeline.data?.net ?? 0) >= 0 ? '+' : ''}
            {formatMoney(timeline.data?.net ?? 0)}
          </Text>
        </View>
      </Card>

      <Button label={'+ ' + t('smart.openCta')} onPress={() => navigation.navigate('SmartEntry')} />

      <View style={{ height: spacing.xl }} />

      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('money.timeline')}
      </Text>

      {timeline.isError ? <ErrorState onRetry={() => timeline.refetch()} /> : null}
      {timeline.isLoading ? <LoadingState /> : null}
      {timeline.data && timeline.data.rows.length === 0 ? (
        <EmptyState title={t('money.empty')} />
      ) : null}

      <View style={{ gap: spacing.md }}>
        {timeline.data?.rows.map((row) => (
          <TimelineRow
            key={`${row.kind}-${row.id}`}
            row={row}
            locale={i18n.language as 'vi' | 'en'}
            onDelete={() => setPendingDelete(row)}
          />
        ))}
      </View>

      <ConfirmModal
        visible={!!pendingDelete}
        title={t(
          pendingDelete?.kind === 'INCOME'
            ? 'money.confirmDeleteIncomeTitle'
            : 'money.confirmDeleteTitle',
        )}
        body={pendingDelete?.title}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </AppScreen>
  );
}

function TimelineRow({
  row,
  locale,
  onDelete,
}: {
  row: TimelineEntry;
  locale: 'vi' | 'en';
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isIncome = row.kind === 'INCOME';
  const tone = isIncome ? '#2E8B57' : '#C24A3F';
  return (
    <Card style={{ borderLeftWidth: 3, borderLeftColor: tone, paddingLeft: spacing.md }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="bodyEm">{row.title}</Text>
          <Text variant="caption">
            {t(`money.categories.${row.category}`, { defaultValue: row.category })} ·{' '}
            {relativeTime(row.occurredAt, locale)}
          </Text>
        </View>
        <Text variant="bodyEm" style={{ color: tone }}>
          {isIncome ? '+' : '-'}
          {formatMoney(row.amount)}
        </Text>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Button label={t('common.delete')} variant="ghost" onPress={onDelete} size="md" />
      </View>
    </Card>
  );
}
