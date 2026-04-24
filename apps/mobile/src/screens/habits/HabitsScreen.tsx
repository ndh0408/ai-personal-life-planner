import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { Habit } from '@planner/shared';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Button,
  Chip,
  EmptyState,
  Loading,
  ErrorView,
} from '../../components/ui';
import { habitsApi, type HabitLog } from '../../services/api/habits.api';
import { syncQueue } from '../../services/offline/sync-queue';
import { QUERY_KEYS } from '../../constants';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { todayIso } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'ALL' | 'TODAY' | 'COMPLETED';
const FILTERS: Filter[] = ['ALL', 'TODAY', 'COMPLETED'];

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Consecutive-day streak back from today using a sorted-by-date-desc log list. */
function computeStreak(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  const byDate = new Map(logs.map((l) => [l.date.slice(0, 10), l]));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const key = daysAgoIso(i);
    const entry = byDate.get(key);
    if (entry?.completed) streak += 1;
    else if (i === 0 && !entry) continue; // no log yet for today
    else break;
  }
  return streak;
}

export function HabitsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');

  const habitsQ = useQuery({ queryKey: QUERY_KEYS.habits, queryFn: habitsApi.list });
  const todayLogsQ = useQuery({
    queryKey: ['habit-logs', 'today'],
    queryFn: () => habitsApi.logs({ date: todayIso() }),
  });
  const rangeLogsQ = useQuery({
    queryKey: ['habit-logs', 'range-30'],
    queryFn: () => habitsApi.logs({ from: daysAgoIso(30), to: todayIso() }),
    staleTime: 60_000,
  });

  const byHabitToday = useMemo(() => {
    const m = new Map<string, HabitLog>();
    (todayLogsQ.data ?? []).forEach((l) => m.set(l.habitId, l));
    return m;
  }, [todayLogsQ.data]);

  const streaksByHabit = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<string, HabitLog[]>();
    (rangeLogsQ.data ?? []).forEach((l) => {
      const arr = grouped.get(l.habitId) ?? [];
      arr.push(l);
      grouped.set(l.habitId, arr);
    });
    for (const [id, logs] of grouped) {
      map.set(id, computeStreak(logs));
    }
    return map;
  }, [rangeLogsQ.data]);

  const items = useMemo(() => {
    const all = (habitsQ.data ?? []).filter((h) => h.isActive);
    if (filter === 'ALL') return all;
    if (filter === 'TODAY') {
      return all.filter((h) => {
        const log = byHabitToday.get(h.id);
        const completed = log && log.count >= h.targetCount;
        return !completed;
      });
    }
    // COMPLETED today
    return all.filter((h) => {
      const log = byHabitToday.get(h.id);
      return !!log && log.count >= h.targetCount;
    });
  }, [habitsQ.data, byHabitToday, filter]);

  const checkInMut = useMutation({
    mutationFn: async (vars: { habit: Habit; direction: 'up' | 'undo' }) => {
      const { habit, direction } = vars;
      const existing = byHabitToday.get(habit.id);
      const date = todayIso();
      if (direction === 'undo') {
        // Undo: set count back to 0 + completed=false.
        return syncQueue.runOrQueue(
          { kind: 'habit:log', payload: { habitId: habit.id, date, completed: false, count: 0 } },
          () => habitsApi.log(habit.id, { count: 0, completed: false }),
        );
      }
      const currentCount = existing?.count ?? 0;
      const next = Math.min(currentCount + 1, habit.targetCount);
      const completed = next >= habit.targetCount;
      return syncQueue.runOrQueue(
        { kind: 'habit:log', payload: { habitId: habit.id, date, completed, count: next } },
        () => habitsApi.log(habit.id, { count: next, completed }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  if (habitsQ.isLoading && !habitsQ.data) return <Loading />;
  if (habitsQ.error && !habitsQ.data) {
    return <ErrorView message={translateError(habitsQ.error)} onRetry={() => habitsQ.refetch()} />;
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
          <Text style={[typography.display, { color: colors.text }]}>
            {t('habits.title')}
          </Text>
          <Button
            title={`+ ${t('habits.addNew')}`}
            size="sm"
            onPress={() => nav.navigate('CreateHabit')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={t(`habits.filter.${f}`)}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>
      </View>

      <FlatList<Habit>
        data={items}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={habitsQ.isRefetching || todayLogsQ.isRefetching}
            onRefresh={() => {
              habitsQ.refetch();
              todayLogsQ.refetch();
              rangeLogsQ.refetch();
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={t(`habits.empty.${filter}.title`)}
            description={t(`habits.empty.${filter}.description`)}
          />
        }
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            todayLog={byHabitToday.get(item.id)}
            streak={streaksByHabit.get(item.id) ?? 0}
            onCheckIn={() => checkInMut.mutate({ habit: item, direction: 'up' })}
            onUndo={() => checkInMut.mutate({ habit: item, direction: 'undo' })}
            onPress={() => nav.navigate('CreateHabit', { habitId: item.id } as never)}
          />
        )}
      />
    </View>
  );
}

function HabitCard({
  habit,
  todayLog,
  streak,
  onCheckIn,
  onUndo,
  onPress,
}: {
  habit: Habit;
  todayLog: HabitLog | undefined;
  streak: number;
  onCheckIn: () => void;
  onUndo: () => void;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const count = todayLog?.count ?? 0;
  const target = habit.targetCount;
  const pct = target > 0 ? Math.min(100, (count / target) * 100) : 0;
  const done = count >= target;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              backgroundColor: habit.color ? habit.color + '33' : colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>{habit.icon || '🔁'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}
            >
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {habit.name}
              </Text>
              <Badge tone="neutral">{habit.frequency}</Badge>
              {streak > 0 ? (
                <Badge tone="warning">🔥 {t('habits.streak', { count: streak })}</Badge>
              ) : null}
            </View>
            {habit.description ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {habit.description}
              </Text>
            ) : null}
            {/* Progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.pill,
                marginTop: spacing.sm,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: done ? colors.success : habit.color || colors.primary,
                  borderRadius: radius.pill,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: spacing.sm,
              }}
            >
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {count}/{target} · {t('habits.todayLabel')}
              </Text>
              {done ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onUndo();
                  }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={[typography.small, { color: colors.textMuted, fontWeight: '700' }]}>
                    {t('habits.undo')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onCheckIn();
                  }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.pill,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={[typography.small, { color: colors.textInverse, fontWeight: '700' }]}>
                    {target === 1 ? t('habits.checkin') : t('habits.plusOne')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
