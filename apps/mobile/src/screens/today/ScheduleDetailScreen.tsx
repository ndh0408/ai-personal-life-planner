import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, EmptyState, Badge } from '../../components/ui';
import { TimelineItem } from '../../components/planner/TimelineItem';
import { schedulesApi } from '../../services/api/schedules.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootScreenProps } from '../../navigation/types';

export function ScheduleDetailScreen({ route }: RootScreenProps<'ScheduleDetail'>) {
  const { date } = route.params;
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const q = useQuery({
    queryKey: QUERY_KEYS.schedule(date),
    queryFn: () => schedulesApi.byDate(date),
  });

  return (
    <Screen scroll>
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{date}</Text>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <EmptyState title={t('schedule.noPlan')} description={t('schedule.noPlanHint')} />
      ) : (
        <>
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              {q.data.summary ?? t('schedule.noSummary')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              {q.data.aiGenerated ? <Badge tone="primary">AI</Badge> : null}
              <Badge tone="info">{q.data.status}</Badge>
            </View>
          </Card>
          {q.data.items.map((item, i) => (
            <TimelineItem
              key={item.id}
              title={item.title}
              description={item.description}
              startTime={item.startTime}
              endTime={item.endTime}
              type={item.type}
              status={item.status}
              isLast={i === q.data!.items.length - 1}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
