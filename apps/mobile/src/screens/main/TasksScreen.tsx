import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Chip,
  ConfirmModal,
  EmptyState,
  ErrorState,
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { tasksService, type TaskRow } from '../../services/api/tasks.service';
import { FEED_KEYS } from '../../hooks/useFeed';
import { TaskRowCard } from '../../components/today/TaskRowCard';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tasks'>;

type Filter = 'today' | 'week' | 'month';

export function TasksScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('today');
  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null);

  const list = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => tasksService.list(filter),
  });

  const complete = useMutation({
    mutationFn: (id: string) => tasksService.complete(id),
    onSuccess: () => {
      toast.show(t('tasks.completed'), 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => tasksService.remove(id),
    onSuccess: () => {
      toast.show(t('common.deleted'), 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: FEED_KEYS.tasksToday });
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const refreshing = list.isFetching && !list.isLoading;

  return (
    <AppScreen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => list.refetch()} />
      }
    >
      <Text variant="kicker">{t('tasks.kicker')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        {t('tasks.title')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {(['today', 'week', 'month'] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={t(`tasks.filters.${f}`)}
            tone="accent"
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <Button label={'+ ' + t('smart.openCta')} onPress={() => navigation.navigate('SmartEntry')} />

      <View style={{ height: spacing.lg }} />

      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.rows.length === 0 ? (
        <EmptyState title={t('tasks.empty')} />
      ) : null}

      <View style={{ gap: spacing.md }}>
        {list.data?.rows.map((row) => (
          <TaskRowCard
            key={row.id}
            row={row}
            locale={i18n.language as 'vi' | 'en'}
            onComplete={() => complete.mutate(row.id)}
            onDelete={() => setPendingDelete(row)}
            disabled={complete.isPending || remove.isPending}
            showFullDate
          />
        ))}
      </View>

      <ConfirmModal
        visible={!!pendingDelete}
        title={t('tasks.confirmDeleteTitle')}
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
