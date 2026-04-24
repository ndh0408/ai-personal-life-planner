import React from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen, Button, Card, Badge, EmptyState, Loading, ErrorView } from '../../components/ui';
import { habitsApi } from '../../services/api/habits.api';
import { QUERY_KEYS } from '../../constants';
import { todayIso } from '../../utils/format';
import type { Habit } from '@planner/shared';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export function HabitsScreen() {
  const { colors, spacing } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const habitsQ = useQuery({ queryKey: QUERY_KEYS.habits, queryFn: habitsApi.list });
  const today = todayIso();
  const logsQ = useQuery({
    queryKey: QUERY_KEYS.habitLogs({ date: today }),
    queryFn: () => habitsApi.logs({ date: today }),
  });

  const logMut = useMutation({
    mutationFn: (id: string) =>
      habitsApi.log(id, { date: today, completed: true, count: 1 } as never),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    onError: (e: Error) => Alert.alert('Could not log', e.message),
  });

  const completedToday = new Set((logsQ.data ?? []).filter((l) => l.completed).map((l) => l.habitId));

  return (
    <Screen padded={false}>
      <View
        style={{
          padding: spacing.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>Habits</Text>
        <Button title="+ New" size="sm" onPress={() => navigation.navigate('CreateHabit')} />
      </View>

      {habitsQ.isLoading ? (
        <Loading />
      ) : habitsQ.isError ? (
        <ErrorView message={(habitsQ.error as Error).message} onRetry={() => habitsQ.refetch()} />
      ) : (
        <FlatList<Habit>
          data={habitsQ.data ?? []}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={habitsQ.isFetching || logsQ.isFetching}
              onRefresh={() => {
                habitsQ.refetch();
                logsQ.refetch();
              }}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              title="No habits yet"
              description="Track recurring things you care about — water, meditation, workouts."
              actionLabel="Create habit"
              onAction={() => navigation.navigate('CreateHabit')}
            />
          }
          renderItem={({ item }) => {
            const done = completedToday.has(item.id);
            return (
              <Pressable onPress={() => logMut.mutate(item.id)}>
                <Card>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                        {item.name}
                      </Text>
                      {item.description ? (
                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                    <Badge tone={done ? 'success' : 'neutral'}>
                      {done ? 'Done today' : `${item.frequency} · ${item.targetCount}`}
                    </Badge>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
