import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Loading,
  ErrorView,
  EmptyState,
  InsightCard,
  Badge,
  Button,
} from '../../components/ui';
import { healthMetricsApi, type HealthMetric } from '../../services/api/health.api';
import { sleepApi, moodApi, type SleepLog, type MoodLog } from '../../services/api/sleep-mood.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, todayIso } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function trend(series: number[]): 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN' {
  if (series.length < 4) return 'UNKNOWN';
  const half = Math.floor(series.length / 2);
  const a = avg(series.slice(0, half))!;
  const b = avg(series.slice(half))!;
  const diff = b - a;
  if (Math.abs(diff) < Math.max(0.25, a * 0.05)) return 'FLAT';
  return diff > 0 ? 'UP' : 'DOWN';
}

export function HealthScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();

  const from = daysAgoIso(7);
  const to = todayIso();

  const sleepQ = useQuery({
    queryKey: ['sleep-logs', from, to],
    queryFn: () => sleepApi.list({ from, to }),
  });
  const moodQ = useQuery({
    queryKey: ['mood-logs', from, to],
    queryFn: () => moodApi.list({ from, to }),
  });
  const metricsQ = useQuery({
    queryKey: ['health-metrics', from, to],
    queryFn: () => healthMetricsApi.list({ from, to }),
  });

  const refreshing =
    sleepQ.isRefetching || moodQ.isRefetching || metricsQ.isRefetching;

  const firstError = sleepQ.error || moodQ.error || metricsQ.error;

  const sleepRows: SleepLog[] = sleepQ.data ?? [];
  const moodRows: MoodLog[] = moodQ.data ?? [];
  const metricRows: HealthMetric[] = metricsQ.data ?? [];

  const today = todayIso();
  const latestSleep = sleepRows[0];
  const todayMood = moodRows.find((m) => m.date.slice(0, 10) === today);
  const todayMetric = metricRows.find((r) => r.date.slice(0, 10) === today);

  const sleepInsights = useMemo(() => {
    const durations = sleepRows.map((l) => l.durationMinutes).filter(Number.isFinite);
    const durationsInHours = durations.map((m) => m / 60);
    return {
      avgHours: avg(durations) ? (avg(durations) as number) / 60 : null,
      trend: trend(durationsInHours),
      nights: sleepRows.length,
    };
  }, [sleepRows]);

  const moodInsights = useMemo(() => {
    const energy = moodRows.map((m) => (m.energyLevel === 'HIGH' ? 3 : m.energyLevel === 'MEDIUM' ? 2 : 1));
    const stress = moodRows.map((m) => (m.stressLevel === 'HIGH' ? 3 : m.stressLevel === 'MEDIUM' ? 2 : 1));
    return {
      energyTrend: trend(energy),
      stressTrend: trend(stress),
    };
  }, [moodRows]);

  const metricAverages = useMemo(() => {
    return {
      weight: avg(metricRows.map((r) => r.weightKg).filter((v): v is number => v !== null)),
      steps: avg(metricRows.map((r) => r.steps).filter((v): v is number => v !== null)),
      water: avg(metricRows.map((r) => r.waterIntakeMl).filter((v): v is number => v !== null)),
      exerciseSum: metricRows.reduce((s, r) => s + (r.exerciseMinutes ?? 0), 0),
    };
  }, [metricRows]);

  // Locale-aware lifestyle insight (no AI call). Gentle, non-diagnostic.
  const insightMessage = useMemo(() => {
    if (!sleepInsights.avgHours) return t('health.insight.needData');
    if (sleepInsights.avgHours < 6) return t('health.insight.underslept');
    if (moodInsights.stressTrend === 'UP') return t('health.insight.stressRising');
    if (moodInsights.energyTrend === 'DOWN') return t('health.insight.energyDown');
    return t('health.insight.steady');
  }, [sleepInsights, moodInsights, t]);

  if (
    (sleepQ.isLoading || moodQ.isLoading || metricsQ.isLoading) &&
    !sleepQ.data &&
    !moodQ.data &&
    !metricsQ.data
  ) {
    return <Loading />;
  }
  if (firstError && sleepRows.length === 0 && moodRows.length === 0 && metricRows.length === 0) {
    return (
      <ErrorView
        message={translateError(firstError)}
        onRetry={() => {
          sleepQ.refetch();
          moodQ.refetch();
          metricsQ.refetch();
        }}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            sleepQ.refetch();
            moodQ.refetch();
            metricsQ.refetch();
          }}
        />
      }
    >
      <Text style={[typography.display, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('health.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('health.subtitle')}
      </Text>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Button
          title={t('health.checkinCta')}
          onPress={() => nav.navigate('SleepMoodCheckin')}
          style={{ flex: 1 }}
        />
        <Button
          title={t('health.logMetricCta')}
          variant="secondary"
          onPress={() => nav.navigate('HealthMetric' as never)}
          style={{ flex: 1 }}
        />
      </View>

      {/* 1. SLEEP */}
      <SectionHeader title={t('health.sleepSummary.title')} />
      {latestSleep ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
            <StatBlock
              label={t('health.sleepSummary.slept')}
              value={hhmm(latestSleep.sleepTime)}
            />
            <StatBlock
              label={t('health.sleepSummary.woke')}
              value={hhmm(latestSleep.wakeTime)}
            />
            <StatBlock
              label={t('health.sleepSummary.duration')}
              value={`${(latestSleep.durationMinutes / 60).toFixed(1)}h`}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Badge tone={qualityTone(latestSleep.quality)}>
              {t(`health.sleepSummary.quality.${latestSleep.quality}`)}
            </Badge>
            <Badge tone="neutral">
              {t('health.sleepSummary.dateLabel', {
                date: formatDateByLocale(latestSleep.date, { weekday: 'short' }),
              })}
            </Badge>
          </View>
        </Card>
      ) : (
        <EmptyState
          title={t('health.sleepSummary.empty.title')}
          description={t('health.sleepSummary.empty.description')}
        />
      )}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.sleepSummary.avg7d')}
            value={
              sleepInsights.avgHours !== null
                ? `${sleepInsights.avgHours.toFixed(1)}h`
                : null
            }
            trend={sleepInsights.trend}
            subtitle={t('health.sleepSummary.nights', { count: sleepInsights.nights })}
          />
        </View>
      </View>

      {/* 2. MOOD / ENERGY */}
      <SectionHeader title={t('health.moodSummary.title')} />
      {todayMood ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            <StatBlock label={t('health.moodSummary.mood')} value={todayMood.mood} />
            <StatBlock label={t('health.moodSummary.energy')} value={todayMood.energyLevel} />
            <StatBlock label={t('health.moodSummary.stress')} value={todayMood.stressLevel} />
          </View>
          {todayMood.note ? (
            <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>
              {todayMood.note}
            </Text>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          title={t('health.moodSummary.empty.title')}
          description={t('health.moodSummary.empty.description')}
        />
      )}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.moodSummary.energyTrend')}
            value="—"
            trend={moodInsights.energyTrend}
            subtitle={t('health.moodSummary.trendSub', { count: moodRows.length })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.moodSummary.stressTrend')}
            value="—"
            trend={moodInsights.stressTrend}
            subtitle={t('health.moodSummary.trendSub', { count: moodRows.length })}
          />
        </View>
      </View>

      {/* 3. HEALTH METRICS */}
      <SectionHeader title={t('health.metrics.title')} />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.metrics.weight')}
            value={
              metricAverages.weight !== null
                ? `${metricAverages.weight.toFixed(1)} kg`
                : todayMetric?.weightKg
                  ? `${todayMetric.weightKg} kg`
                  : null
            }
            subtitle={metricAverages.weight !== null ? t('health.metrics.avg7d') : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.metrics.steps')}
            value={
              metricAverages.steps !== null
                ? Math.round(metricAverages.steps)
                : todayMetric?.steps ?? null
            }
            subtitle={metricAverages.steps !== null ? t('health.metrics.avg7d') : undefined}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.metrics.water')}
            value={
              metricAverages.water !== null
                ? `${Math.round(metricAverages.water)} ml`
                : null
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('health.metrics.exercise7d')}
            value={`${metricAverages.exerciseSum} ${t('tasks.min')}`}
          />
        </View>
      </View>

      {/* 4. AI / LIFESTYLE INSIGHT */}
      <SectionHeader title={t('health.insight.title')} />
      <Card>
        <Text style={{ color: colors.text, lineHeight: 22 }}>{insightMessage}</Text>
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
          {t('health.insight.disclaimer')}
        </Text>
      </Card>

      {/* Recent entries list */}
      {metricRows.length > 0 ? (
        <>
          <SectionHeader title={t('health.recent')} />
          <View style={{ gap: spacing.md }}>
            {metricRows.slice(0, 7).map((m) => (
              <Card key={m.id}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {formatDateByLocale(m.date)}
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs }}
                >
                  {m.weightKg !== null ? (
                    <Text style={{ color: colors.textMuted }}>
                      {t('health.metrics.weightShort')}: {m.weightKg} kg
                    </Text>
                  ) : null}
                  {m.steps !== null ? (
                    <Text style={{ color: colors.textMuted }}>
                      {t('health.metrics.stepsShort')}: {m.steps}
                    </Text>
                  ) : null}
                  {m.waterIntakeMl !== null ? (
                    <Text style={{ color: colors.textMuted }}>
                      {t('health.metrics.waterShort')}: {m.waterIntakeMl} ml
                    </Text>
                  ) : null}
                  {m.exerciseMinutes ? (
                    <Text style={{ color: colors.textMuted }}>
                      {t('health.metrics.exerciseShort')}: {m.exerciseMinutes} {t('tasks.min')}
                    </Text>
                  ) : null}
                </View>
                {m.note ? (
                  <Text style={{ color: colors.textMuted, marginTop: spacing.xs }}>{m.note}</Text>
                ) : null}
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
      {title}
    </Text>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.h2, { color: colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

function hhmm(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function qualityTone(q: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (q === 'VERY_GOOD' || q === 'GOOD') return 'success';
  if (q === 'NORMAL') return 'neutral';
  if (q === 'BAD') return 'warning';
  return 'danger';
}
