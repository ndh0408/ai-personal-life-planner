import React, { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen, Button, Loading, ErrorView, EmptyState, Card, Badge } from '../../components/ui';
import { TimelineItem } from '../../components/planner/TimelineItem';
import { schedulesApi } from '../../services/api/schedules.api';
import { aiApi } from '../../services/api/ai.api';
import { QUERY_KEYS } from '../../constants';
import { todayIso, formatDateLong } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export function TodayScreen() {
  const { colors, spacing } = useTheme();
  const date = todayIso();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const scheduleQ = useQuery({
    queryKey: QUERY_KEYS.schedule(date),
    queryFn: () => schedulesApi.byDate(date),
  });

  const generateMut = useMutation({
    mutationFn: () => aiApi.generateSchedule({ date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) }),
    onError: (e: Error) => Alert.alert('AI failed', e.message),
  });

  const setStatusMut = useMutation({
    mutationFn: (vars: { id: string; status: 'PENDING' | 'COMPLETED' }) =>
      schedulesApi.setItemStatus(vars.id, vars.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) }),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) });
  }, [queryClient, date]);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={scheduleQ.isFetching} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Hi {user?.displayName ?? 'there'}</Text>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>
            {formatDateLong(new Date())}
          </Text>
        </View>

        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.primary + '10', borderColor: colors.primary + '40' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
                AI assistant
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Generate today's plan or chat for tips.
              </Text>
            </View>
            <Button
              title="Plan day"
              size="sm"
              loading={generateMut.isPending}
              onPress={() => generateMut.mutate()}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Chat" variant="secondary" size="sm" onPress={() => navigation.navigate('AIChat')} />
            <Button
              title="Sleep / mood"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate('SleepMoodCheckin')}
            />
            <Button
              title="Weekly report"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate('WeeklyReport')}
            />
          </View>
        </Card>

        {scheduleQ.isLoading ? (
          <Loading label="Loading today's plan…" />
        ) : scheduleQ.isError ? (
          <ErrorView message={(scheduleQ.error as Error).message} onRetry={refresh} />
        ) : !scheduleQ.data ? (
          <EmptyState
            title="No plan yet for today"
            description="Tap 'Plan day' to let AI build one from your profile, tasks and habits."
            actionLabel="Generate now"
            onAction={() => generateMut.mutate()}
          />
        ) : (
          <View>
            {scheduleQ.data.summary ? (
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
                  {scheduleQ.data.summary}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                  {scheduleQ.data.aiGenerated ? <Badge tone="primary">AI</Badge> : null}
                  <Badge tone="info">{scheduleQ.data.status}</Badge>
                </View>
              </Card>
            ) : null}
            {scheduleQ.data.items.map((item, idx) => (
              <TimelineItem
                key={item.id}
                title={item.title}
                description={item.description}
                startTime={item.startTime}
                endTime={item.endTime}
                type={item.type}
                status={item.status}
                isLast={idx === scheduleQ.data!.items.length - 1}
                onPress={() =>
                  setStatusMut.mutate({
                    id: item.id,
                    status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
