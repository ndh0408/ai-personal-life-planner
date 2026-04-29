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
  Icon,
  LoadingState,
  Sparkline,
  Text,
  useToast,
} from '../../components/ui';
import { colors, spacing } from '../../theme';
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
        <FinanceStatCard
          icon="arrow-up-circle"
          label={t('money.totalIncome')}
          value={'+' + formatMoney(timeline.data?.totalIncome ?? 0)}
          tone={colors.income.base}
          haloBg={colors.income.soft}
          spark={buildSpark(timeline.data?.rows ?? [], 'INCOME')}
        />
        <FinanceStatCard
          icon="arrow-down-circle"
          label={t('money.totalExpense')}
          value={'−' + formatMoney(timeline.data?.totalExpense ?? 0)}
          tone={colors.expense.base}
          haloBg={colors.expense.soft}
          spark={buildSpark(timeline.data?.rows ?? [], 'EXPENSE')}
        />
      </View>
      <Card
        emphasis="elevated"
        style={{
          marginBottom: spacing.xl,
          borderColor:
            (timeline.data?.net ?? 0) >= 0 ? colors.income.base + '55' : colors.expense.base + '55',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="kicker">{t('money.net')}</Text>
          <Text
            variant="bodyEm"
            style={{
              color: (timeline.data?.net ?? 0) >= 0 ? colors.income.base : colors.expense.base,
              fontSize: 18,
              fontVariant: ['tabular-nums'],
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
  const tone = isIncome ? colors.income.base : colors.expense.base;
  const haloBg = isIncome ? colors.income.soft : colors.expense.soft;
  return (
    <Card style={{ borderLeftWidth: 3, borderLeftColor: tone, paddingLeft: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: haloBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={isIncome ? 'arrow-up-circle' : 'arrow-down-circle'}
            size={20}
            color={tone}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyEm" numberOfLines={1}>
            {row.title}
          </Text>
          <Text variant="caption">
            {t(`money.categories.${row.category}`, { defaultValue: row.category })} ·{' '}
            {relativeTime(row.occurredAt, locale)}
          </Text>
        </View>
        <Text variant="bodyEm" style={{ color: tone, fontVariant: ['tabular-nums'] }}>
          {isIncome ? '+' : '−'}
          {formatMoney(row.amount)}
        </Text>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Button label={t('common.delete')} variant="ghost" onPress={onDelete} size="md" />
      </View>
    </Card>
  );
}

function FinanceStatCard({
  icon,
  label,
  value,
  tone,
  haloBg,
  spark,
}: {
  icon: 'arrow-up-circle' | 'arrow-down-circle';
  label: string;
  value: string;
  tone: string;
  haloBg: string;
  spark: number[];
}) {
  return (
    <Card style={{ flex: 1, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: haloBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} color={tone} />
        </View>
        <Text variant="kicker" style={{ flex: 1 }}>
          {label}
        </Text>
      </View>
      <Text
        variant="bodyEm"
        style={{ color: tone, fontSize: 20, fontVariant: ['tabular-nums'], marginTop: 4 }}
      >
        {value}
      </Text>
      {spark.length >= 2 ? (
        <View style={{ marginTop: 6, marginLeft: -4 }}>
          <Sparkline values={spark} width={140} height={28} color={tone} fillFrom={tone + '22'} fillTo={tone + '02'} />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Build a 7-bucket spark series of daily totals for the requested kind from
 * the timeline rows. Buckets are local-day. If there are no rows, returns [].
 */
function buildSpark(rows: TimelineEntry[], kind: 'INCOME' | 'EXPENSE'): number[] {
  if (rows.length === 0) return [];
  const days = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Array<number>(days).fill(0);
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const d = new Date(r.occurredAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60_000));
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += r.amount;
  }
  if (buckets.every((v) => v === 0)) return [];
  return buckets;
}
