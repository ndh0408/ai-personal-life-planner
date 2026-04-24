import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Button,
  Chip,
  ProgressCard,
  Loading,
  ErrorView,
  EmptyState,
} from '../../components/ui';
import { goalsApi, type GoalCategory, type PersonalGoal } from '../../services/api/goals.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES: (GoalCategory | 'ALL')[] = [
  'ALL',
  'HEALTH',
  'FINANCE',
  'CAREER',
  'STUDY',
  'RELATIONSHIP',
  'PERSONAL',
  'OTHER',
];

export function PersonalGoalsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const q = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.list() });
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>('ALL');

  const items = useMemo(() => {
    const all = (q.data ?? []).filter((g) => g.status === 'ACTIVE');
    if (filter === 'ALL') return all;
    return all.filter((g) => g.category === filter);
  }, [q.data, filter]);

  if (q.isLoading && !q.data) return <Loading />;
  if (q.error && !q.data) {
    return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.xl, paddingBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Text style={[typography.display, { color: colors.text }]}>{t('goals.title')}</Text>
          <Button
            title={`+ ${t('goals.addNew')}`}
            size="sm"
            onPress={() => nav.navigate('CreateGoal' as never)}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.lg }}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c === 'ALL' ? t('goals.filter.ALL') : t(`goals.category.${c}`)}
              selected={filter === c}
              onPress={() => setFilter(c)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />
        }
      >
        {items.length === 0 ? (
          <EmptyState
            title={t(filter === 'ALL' ? 'goals.empty.title' : 'goals.empty.filteredTitle')}
            description={t(
              filter === 'ALL'
                ? 'goals.empty.description'
                : 'goals.empty.filteredDescription',
            )}
          />
        ) : (
          items.map((g) => (
            <GoalRow key={g.id} goal={g} onPress={() => nav.navigate('GoalDetail', { goalId: g.id } as never)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function GoalRow({ goal, onPress }: { goal: PersonalGoal; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const hasNumeric = goal.targetValue !== null && goal.currentValue !== null && goal.targetValue > 0;
  const completedMilestones = goal.milestones.filter((m) => m.status === 'COMPLETED').length;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, flexWrap: 'wrap' }}>
          <Badge tone="neutral">{t(`goals.category.${goal.category}`)}</Badge>
          <Badge tone={goal.priority === 'HIGH' ? 'danger' : goal.priority === 'MEDIUM' ? 'warning' : 'neutral'}>
            {t(`tasks.priority.${goal.priority}`)}
          </Badge>
          {goal.milestones.length > 0 ? (
            <Badge tone="neutral">
              {completedMilestones}/{goal.milestones.length} {t('goals.milestones')}
            </Badge>
          ) : null}
        </View>
        <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
          {goal.title}
        </Text>
        {goal.description ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]} numberOfLines={2}>
            {goal.description}
          </Text>
        ) : null}
        {hasNumeric ? (
          <View style={{ marginTop: spacing.sm }}>
            <ProgressCard
              title=""
              current={goal.currentValue!}
              target={goal.targetValue!}
              currentLabel={`${goal.currentValue} / ${goal.targetValue} ${goal.unit ?? ''}`.trim()}
            />
          </View>
        ) : null}
        {goal.deadline ? (
          <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('goals.deadline')}: {formatDateByLocale(goal.deadline, { weekday: undefined })}
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}
