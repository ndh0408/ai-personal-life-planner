import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Loading,
  ErrorView,
  EmptyState,
  ProgressCard,
} from '../../components/ui';
import { reportsApi, type GoalProgressReport } from '../../services/api/reports.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GoalProgressReportScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();

  const q = useQuery({
    queryKey: ['reports', 'goal-progress'],
    queryFn: () => reportsApi.goalProgress(),
  });

  const active = useMemo(
    () => (q.data?.goals ?? []).filter((g) => g.status === 'ACTIVE'),
    [q.data],
  );

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;

  const r: GoalProgressReport = q.data!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
    >
      <Text style={[typography.h1, { color: colors.text }]}>{t('reports.goalProgress')}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        {t('reports.goalProgressDescription')}
      </Text>

      {r.goals.length === 0 ? (
        <EmptyState
          title={t('reports.goalsSections.empty.title')}
          description={t('reports.goalsSections.empty.description')}
        />
      ) : (
        <>
          {/* Summary card */}
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('reports.goalsSections.average')}
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {r.averagePercent !== null ? `${r.averagePercent}%` : '—'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('reports.goalsSections.behind')}
                </Text>
                <Text
                  style={[
                    typography.h2,
                    {
                      color: r.behindCount > 0 ? colors.warning : colors.text,
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  {r.behindCount}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, flexWrap: 'wrap' }}>
              {Object.entries(r.byStatus).map(([status, count]) => (
                <Badge key={status} tone="neutral">
                  {t(`goals.status.${status}`)} · {count}
                </Badge>
              ))}
            </View>
          </Card>

          {/* Active list */}
          {active.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('reports.goalsSections.activeGoals')}
              </Text>
              {active.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => nav.navigate('GoalDetail', { goalId: g.id })}
                  activeOpacity={0.7}
                >
                  <ProgressCard
                    title={g.title}
                    current={g.percent ?? 0}
                    target={100}
                    currentLabel={
                      g.percent !== null
                        ? `${g.percent}% · ${g.milestones.completed}/${g.milestones.total} ${t('goals.milestones')}`
                        : '—'
                    }
                    subtitle={
                      g.deadline
                        ? `${t('goals.deadline')}: ${formatDateByLocale(g.deadline, { weekday: undefined })}`
                        : undefined
                    }
                    tone={g.behindDeadline ? 'warning' : 'default'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Other statuses (collapsed summary) */}
          {r.goals.filter((g) => g.status !== 'ACTIVE').length > 0 ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.goalsSections.otherStatuses')}
              </Text>
              {r.goals
                .filter((g) => g.status !== 'ACTIVE')
                .slice(0, 10)
                .map((g) => (
                  <View
                    key={g.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <Text style={{ color: colors.text }} numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Badge tone="neutral">{t(`goals.status.${g.status}`)}</Badge>
                  </View>
                ))}
            </Card>
          ) : null}

          <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('reports.disclaimer')}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
