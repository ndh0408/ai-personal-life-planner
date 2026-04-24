import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen, Button, Card, Badge, Chip, EmptyState, Loading, ErrorView } from '../../components/ui';
import { tasksApi } from '../../services/api/tasks.api';
import { QUERY_KEYS } from '../../constants';
import type { Task, TaskStatus, Priority } from '@planner/shared';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const priorityTone: Record<Priority, 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export function TasksScreen() {
  const { colors, spacing } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>('TODO');

  const tasksQ = useQuery({
    queryKey: QUERY_KEYS.tasks({ status: statusFilter }),
    queryFn: () => tasksApi.list({ status: statusFilter, limit: 100 }),
  });

  const setStatusMut = useMutation({
    mutationFn: (vars: { id: string; status: TaskStatus }) => tasksApi.setStatus(vars.id, vars.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: Error) => Alert.alert('Could not update', e.message),
  });

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>Tasks</Text>
          <Button title="+ New" size="sm" onPress={() => navigation.navigate('CreateTask')} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="All" selected={statusFilter === undefined} onPress={() => setStatusFilter(undefined)} />
          {STATUSES.map((s) => (
            <Chip key={s} label={s} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
          ))}
        </View>
      </View>

      {tasksQ.isLoading ? (
        <Loading label="Loading tasks…" />
      ) : tasksQ.isError ? (
        <ErrorView message={(tasksQ.error as Error).message} onRetry={() => tasksQ.refetch()} />
      ) : (
        <FlatList<Task>
          data={tasksQ.data?.items ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={tasksQ.isFetching} onRefresh={tasksQ.refetch} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              title="No tasks here"
              description="Create your first task or change the filter above."
              actionLabel="Create task"
              onAction={() => navigation.navigate('CreateTask')}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                setStatusMut.mutate({
                  id: item.id,
                  status: item.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
                })
              }
            >
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '600',
                      textDecorationLine: item.status === 'COMPLETED' ? 'line-through' : 'none',
                    }}
                  >
                    {item.title}
                  </Text>
                  <Badge tone={priorityTone[item.priority]}>{item.priority}</Badge>
                </View>
                {item.description ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{item.description}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
                  <Badge tone="neutral">{item.status}</Badge>
                  {item.category ? <Badge tone="info">{item.category}</Badge> : null}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
