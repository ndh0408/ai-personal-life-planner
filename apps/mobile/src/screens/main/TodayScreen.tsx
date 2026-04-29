import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';
import {
  AppScreen,
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
import { TaskRowCard } from '../../components/today/TaskRowCard';
import { MealRowCard } from '../../components/today/MealRowCard';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Today'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function TodayScreen({ navigation }: Props) {
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
      ) : plan.isError && !plan.data ? (
        <ErrorState onRetry={() => plan.refetch()} />
      ) : plan.data ? (
        <View style={{ marginBottom: spacing['2xl'] }}>
          {plan.data.summary ? (
            <Card style={{ marginBottom: spacing.md, backgroundColor: '#FFF7EE' }}>
              <Text variant="bodyEm" style={{ color: '#5A3A22' }}>
                {plan.data.summary}
              </Text>
            </Card>
          ) : null}
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
              label={gen.isPending ? t('common.loading') : t('today.regeneratePlan')}
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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Text variant="kicker">{t('home.stats.tasksToday')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.openTasks')}
          onPress={() => navigation.navigate('Tasks')}
          hitSlop={8}
        >
          <Text variant="caption" style={{ color: '#C97B4A', fontWeight: '700' }}>
            {t('today.openTasks')}
          </Text>
        </Pressable>
      </View>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.data && tasks.data.rows.length === 0 ? (
        <EmptyState title={t('today.empty')} />
      ) : tasks.data ? (
        <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
          {tasks.data.rows.map((row) => (
            <TaskRowCard key={row.id} row={row} locale={i18n.language as 'vi' | 'en'} />
          ))}
        </View>
      ) : null}
      <View style={{ marginBottom: spacing.xl }}>
        <Button
          label={'+ ' + t('smart.openCta')}
          variant="ghost"
          onPress={() => navigation.navigate('SmartEntry')}
        />
      </View>

      {/* Meals */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
          marginTop: spacing.lg,
        }}
      >
        <Text variant="kicker">{t('capture.kinds.MEAL')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.openMeals')}
          onPress={() => navigation.navigate('MealLog')}
          hitSlop={8}
        >
          <Text variant="caption" style={{ color: '#C97B4A', fontWeight: '700' }}>
            {t('today.openMeals')}
          </Text>
        </Pressable>
      </View>
      {meals.isLoading ? (
        <LoadingState />
      ) : meals.data && meals.data.rows.length === 0 ? (
        <EmptyState title={t('today.empty')} />
      ) : meals.data ? (
        <View style={{ gap: spacing.md }}>
          {meals.data.rows.map((m) => (
            <MealRowCard key={m.id} row={m} />
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

