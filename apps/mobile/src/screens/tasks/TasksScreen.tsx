import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { Task, TaskStatus } from '@planner/shared';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Chip,
  Button,
  EmptyState,
  Loading,
  ErrorView,
} from '../../components/ui';
import { tasksApi } from '../../services/api/tasks.api';
import { syncQueue } from '../../services/offline/sync-queue';
import { QUERY_KEYS } from '../../constants';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, todayIso } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Filter = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED';
type Sort = 'dueDate' | 'priority' | 'createdAt';

const FILTERS: Filter[] = ['ALL', 'TODAY', 'UPCOMING', 'OVERDUE', 'COMPLETED'];
const SORTS: Sort[] = ['dueDate', 'priority', 'createdAt'];

export function TasksScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [sortBy, setSortBy] = useState<Sort>('dueDate');
  const [search, setSearch] = useState('');

  const baseQuery = useMemo(() => {
    const q: Parameters<typeof tasksApi.list>[0] = {
      limit: 100,
      sortBy,
      sortDir: sortBy === 'priority' ? 'desc' : 'asc',
    };
    if (filter === 'COMPLETED') q.status = 'COMPLETED';
    else if (filter === 'TODAY') q.dueDate = todayIso();
    if (search.trim().length > 0) q.q = search.trim();
    return q;
  }, [filter, sortBy, search]);

  const tasksQ = useQuery({
    queryKey: QUERY_KEYS.tasks({ ...baseQuery, filter }),
    queryFn: () => tasksApi.list(baseQuery),
  });

  const items = useMemo(() => {
    const list = tasksQ.data?.items ?? [];
    const now = new Date();
    const todayStart = new Date(`${todayIso()}T00:00:00.000Z`);
    if (filter === 'UPCOMING') {
      return list.filter(
        (x) =>
          x.status !== 'COMPLETED' &&
          x.status !== 'CANCELLED' &&
          x.dueDate &&
          new Date(x.dueDate).getTime() > todayStart.getTime() + 86_400_000,
      );
    }
    if (filter === 'OVERDUE') {
      return list.filter(
        (x) =>
          x.status !== 'COMPLETED' &&
          x.status !== 'CANCELLED' &&
          x.dueDate &&
          new Date(x.dueDate).getTime() < now.getTime(),
      );
    }
    if (filter === 'TODAY') {
      return list.filter(
        (x) =>
          x.status !== 'CANCELLED' &&
          x.dueDate &&
          new Date(x.dueDate).toISOString().slice(0, 10) === todayIso(),
      );
    }
    return list;
  }, [tasksQ.data, filter]);

  /**
   * Optimistic complete — toggle status locally before the server
   * acknowledges. Rollback restores every task-list cache we touched.
   * Safe because the status mutation is idempotent and the endpoint
   * returns the authoritative row on success.
   */
  const completeMut = useMutation({
    mutationFn: (task: Task) => {
      const next: TaskStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      return syncQueue.runOrQueue(
        { kind: 'task:setStatus', payload: { taskId: task.id, status: next } },
        () => tasksApi.setStatus(task.id, next),
      );
    },
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = queryClient.getQueriesData<{ items: Task[] }>({
        queryKey: ['tasks'],
      });
      for (const [key, value] of snapshots) {
        if (!value) continue;
        queryClient.setQueryData(key, {
          ...value,
          items: value.items.map((row) =>
            row.id === task.id
              ? {
                  ...row,
                  status:
                    row.status === 'COMPLETED'
                      ? ('TODO' as TaskStatus)
                      : ('COMPLETED' as TaskStatus),
                  completedAt: row.status === 'COMPLETED' ? null : new Date().toISOString(),
                }
              : row,
          ),
        });
      }
      return { snapshots };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, value] of ctx.snapshots) queryClient.setQueryData(key, value);
      }
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (tasksQ.isLoading && !tasksQ.data) return <Loading />;
  if (tasksQ.error && !tasksQ.data) {
    return <ErrorView message={translateError(tasksQ.error)} onRetry={() => tasksQ.refetch()} />;
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
          <Text style={[typography.display, { color: colors.text }]}>{t('tasks.title')}</Text>
          <Button
            title={`+ ${t('tasks.addNew')}`}
            size="sm"
            onPress={() => nav.navigate('CreateTask')}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.md,
          }}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('common.search')}
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, paddingVertical: spacing.sm }}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={t(`tasks.filter.${f}`)}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {t('tasks.sortBy')}
          </Text>
          {SORTS.map((s) => (
            <Chip
              key={s}
              label={t(`tasks.sort.${s}`)}
              selected={sortBy === s}
              onPress={() => setSortBy(s)}
            />
          ))}
        </View>
      </View>

      <FlatList<Task>
        data={items}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={tasksQ.isRefetching} onRefresh={() => tasksQ.refetch()} />
        }
        ListEmptyComponent={
          <EmptyState
            title={t('tasks.empty.title')}
            description={t(`tasks.empty.${filter}`)}
          />
        }
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() => nav.navigate('CreateTask', { taskId: item.id } as never)}
            onComplete={() => completeMut.mutate(item)}
          />
        )}
      />
    </View>
  );
}

function TaskRow({
  task,
  onPress,
  onComplete,
}: {
  task: Task;
  onPress: () => void;
  onComplete: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const done = task.status === 'COMPLETED';
  const overdue =
    !done &&
    !!task.dueDate &&
    new Date(task.dueDate).getTime() < Date.now() &&
    task.status !== 'CANCELLED';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onComplete();
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: done ? colors.success : colors.border,
              backgroundColor: done ? colors.success : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
            }}
            hitSlop={12}
          >
            {done ? <Text style={{ color: colors.textInverse, fontSize: 14 }}>✓</Text> : null}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}
            >
              <Badge
                tone={
                  task.priority === 'HIGH'
                    ? 'danger'
                    : task.priority === 'MEDIUM'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {t(`tasks.priority.${task.priority}`)}
              </Badge>
              {task.category ? <Badge tone="neutral">{task.category}</Badge> : null}
              {overdue ? <Badge tone="danger">{t('tasks.overdue')}</Badge> : null}
            </View>
            <Text
              style={[
                typography.bodyStrong,
                {
                  color: done ? colors.textMuted : colors.text,
                  marginTop: spacing.xs,
                  textDecorationLine: done ? 'line-through' : 'none',
                },
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {task.description ? (
              <Text
                style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
                numberOfLines={2}
              >
                {task.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs, flexWrap: 'wrap' }}>
              {task.dueDate ? (
                <Text
                  style={[typography.small, { color: overdue ? colors.danger : colors.textMuted }]}
                >
                  {formatDateByLocale(task.dueDate, { weekday: undefined })}
                </Text>
              ) : null}
              {task.estimatedMinutes ? (
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {task.estimatedMinutes} {t('tasks.min')}
                </Text>
              ) : null}
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {t(`tasks.status.${task.status}`)}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
