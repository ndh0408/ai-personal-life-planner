import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, RecommendationCard, EmptyState } from '../../components/ui';
import { assistantApi } from '../../services/api/assistant.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';

export function AssistantScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const queryClient = useQueryClient();

  const snapshot = useQuery({
    queryKey: ['assistant', 'today'],
    queryFn: () => assistantApi.today(),
  });

  const runMonitoring = useMutation({
    mutationFn: () => assistantApi.runDailyMonitoring(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant'] }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPLIED' | 'DISMISSED' }) =>
      assistantApi.patchStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant'] }),
  });

  if (snapshot.isLoading) return <Loading />;
  if (snapshot.error) {
    return <ErrorView message={translateError(snapshot.error)} onRetry={() => snapshot.refetch()} />;
  }

  const s = snapshot.data!;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={[typography.display, { color: colors.text }]}>{t('assistant.title')}</Text>
        <TouchableOpacity onPress={() => runMonitoring.mutate()}>
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>
            {runMonitoring.isPending ? t('common.loading') : t('assistant.refresh')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('assistant.subtitle')}
      </Text>

      {/* Pattern highlights */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
          {t('assistant.patterns.title')}
        </Text>
        <PatternRow
          label={t('assistant.patterns.bestHour')}
          value={s.patterns.productivity.bestHourBucket ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.bestHabit')}
          value={s.patterns.habits.bestHabit ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.worstHabit')}
          value={s.patterns.habits.worstHabit ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.overloadedDays')}
          value={String(s.patterns.overload.overloadedDays)}
        />
      </Card>

      {/* Recommendations */}
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
        {t('assistant.recommendations')}
      </Text>
      {s.recommendations.length === 0 ? (
        <EmptyState
          title={t('assistant.empty.title')}
          description={t('assistant.empty.description')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {s.recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              title={r.title}
              content={r.content}
              priority={r.priority}
              type={r.type}
              onDismiss={() => patchStatus.mutate({ id: r.id, status: 'DISMISSED' })}
              onApply={() => patchStatus.mutate({ id: r.id, status: 'APPLIED' })}
              dismissLabel={t('common.skip')}
              applyLabel={t('assistant.action.apply')}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PatternRow({ label, value }: { label: string; value: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
