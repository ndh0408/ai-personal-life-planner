import React from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, EmptyState, InsightCard } from '../../components/ui';
import { healthMetricsApi } from '../../services/api/health.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale } from '../../utils/format';

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function HealthScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const translateError = useErrorMessage();
  const from = daysAgo(14);
  const to = daysAgo(0);

  const q = useQuery({
    queryKey: ['health-metrics', from, to],
    queryFn: () => healthMetricsApi.list({ from, to }),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];

  const avgWeight = avg(rows.map((r) => r.weightKg).filter((v): v is number => v !== null));
  const avgSteps = avg(rows.map((r) => r.steps).filter((v): v is number => v !== null));
  const totalExerciseMin = rows.reduce((s, r) => s + (r.exerciseMinutes ?? 0), 0);

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('health.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('health.subtitle')}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.avgWeight')}
            value={avgWeight !== null ? `${avgWeight.toFixed(1)} kg` : null}
          />
        </View>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.avgSteps')}
            value={avgSteps !== null ? Math.round(avgSteps) : null}
          />
        </View>
      </View>
      <View style={{ marginBottom: spacing.lg }}>
        <InsightCard
          title={t('health.exercise14d')}
          value={`${totalExerciseMin} ${t('health.minutesShort')}`}
        />
      </View>

      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
        {t('health.recent')}
      </Text>
      {rows.length === 0 ? (
        <EmptyState title={t('health.empty.title')} description={t('health.empty.description')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {rows.slice(0, 10).map((m) => (
            <Card key={m.id}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {formatDateByLocale(m.date)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs }}>
                {m.weightKg !== null ? (
                  <Text style={{ color: colors.textMuted }}>
                    {t('health.weightShort')}: {m.weightKg} kg
                  </Text>
                ) : null}
                {m.steps !== null ? (
                  <Text style={{ color: colors.textMuted }}>
                    {t('health.stepsShort')}: {m.steps}
                  </Text>
                ) : null}
                {m.waterIntakeMl !== null ? (
                  <Text style={{ color: colors.textMuted }}>
                    {t('health.waterShort')}: {m.waterIntakeMl} ml
                  </Text>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
