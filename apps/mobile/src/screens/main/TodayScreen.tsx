import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppScreen,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Text,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useTodayMeals, useTodayTasks } from '../../hooks/useFeed';
import { useGenerateTodayPlan, useSetItemStatus, useTodayPlan } from '../../hooks/usePlanner';
import { PlanItemRow } from '../../components/today/PlanItemRow';
import type { TaskRow } from '../../services/api/tasks.service';
import type { MealRow } from '../../services/api/journal.service';
import { formatMoney } from '../../utils/format';

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const tasks = useTodayTasks();
  const meals = useTodayMeals();
  const plan = useTodayPlan();
  const gen = useGenerateTodayPlan();
  const setStatus = useSetItemStatus();

  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.today')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('today.title')}
      </Text>

      {/* Plan timeline */}
      {plan.isLoading ? (
        <LoadingState />
      ) : plan.data ? (
        <View style={{ marginBottom: spacing['2xl'] }}>
          {plan.data.aiGenerated ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: spacing.md,
              }}
            >
              <Text variant="caption" style={{ color: '#C97B4A', fontWeight: '700' }}>
                ✨ AI
              </Text>
              <Text variant="caption">— Lên kế hoạch theo dữ liệu của bạn</Text>
            </View>
          ) : null}
          {plan.data.items.map((item) => (
            <PlanItemRow
              key={item.id}
              item={item}
              onToggle={(status) => setStatus.mutate({ id: item.id, status })}
            />
          ))}
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={gen.isPending ? t('common.loading') : t('common.retry')}
              variant="ghost"
              onPress={() => gen.mutate()}
              disabled={gen.isPending}
            />
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: spacing['2xl'], gap: spacing.md }}>
          <EmptyState title={t('today.empty')} />
          <Button
            label={gen.isPending ? t('common.loading') : '✨ ' + t('common.next')}
            onPress={() => gen.mutate()}
            disabled={gen.isPending}
            loading={gen.isPending}
          />
        </View>
      )}

      {tasks.isError || meals.isError ? (
        <ErrorState
          onRetry={() => {
            void tasks.refetch();
            void meals.refetch();
          }}
        />
      ) : null}

      {/* Tasks */}
      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('home.stats.tasksToday')}
      </Text>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.data && tasks.data.rows.length === 0 ? (
        <EmptyState title={t('today.empty')} />
      ) : (
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {tasks.data!.rows.map((row) => (
            <TaskRowCard key={row.id} row={row} locale={i18n.language as 'vi' | 'en'} />
          ))}
        </View>
      )}

      {/* Meals */}
      <Text variant="kicker" style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>
        {t('capture.kinds.MEAL')}
      </Text>
      {meals.isLoading ? (
        <LoadingState />
      ) : meals.data && meals.data.rows.length === 0 ? (
        <EmptyState title={t('today.empty')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {meals.data!.rows.map((m) => (
            <MealRowCard key={m.id} row={m} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

function TaskRowCard({ row, locale }: { row: TaskRow; locale: 'vi' | 'en' }) {
  const { t } = useTranslation();
  const dueLabel =
    row.dueAt &&
    new Date(row.dueAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  const tone =
    row.status === 'COMPLETED'
      ? 'success'
      : row.status === 'IN_PROGRESS'
      ? 'info'
      : row.priority === 'HIGH'
      ? 'danger'
      : 'neutral';
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="bodyEm" style={{ flex: 1 }}>
          {row.title}
        </Text>
        <Badge label={t(`capture.priorities.${row.priority}`)} tone={tone} />
      </View>
      {dueLabel ? <Text variant="caption">{dueLabel}</Text> : null}
    </Card>
  );
}

function MealRowCard({ row }: { row: MealRow }) {
  const { t } = useTranslation();
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="bodyEm" style={{ flex: 1 }}>
          {row.title}
        </Text>
        <Badge label={t(`capture.mealTypes.${row.mealType}`)} tone="success" />
      </View>
      {row.cost != null ? <Text variant="caption">{formatMoney(row.cost)}</Text> : null}
    </Card>
  );
}
