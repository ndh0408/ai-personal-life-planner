import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Screen,
  Card,
  Button,
  Badge,
  BarChart,
  Loading,
  ErrorView,
  EmptyState,
  ProgressCard,
} from '../../components/ui';
import { reportsApi, type WeeklyReport } from '../../services/api/reports.api';
import { aiApi, type WeeklyInsightResponse } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale, formatDateByLocale } from '../../utils/format';

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function dayShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function WeeklyReportScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const weekStart = startOfWeekIso();

  const reportQ = useQuery({
    queryKey: ['reports', 'weekly', weekStart],
    queryFn: () => reportsApi.weekly(weekStart),
  });

  const [aiInsight, setAiInsight] = useState<WeeklyInsightResponse['insight'] | null>(null);
  const aiMut = useMutation({
    mutationFn: () => aiApi.weeklyInsight({ weekStart }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
    onSuccess: (res) => setAiInsight(res.insight),
  });

  const scheduleBars = useMemo(() => {
    if (!reportQ.data) return [];
    return reportQ.data.schedule.byDay.map((b) => ({
      label: dayShort(b.date),
      value: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
      caption: b.total > 0 ? `${b.completed}/${b.total}` : '—',
    }));
  }, [reportQ.data]);

  const spendingBars = useMemo(() => {
    if (!reportQ.data) return [];
    return reportQ.data.spending.byDay.map((b) => ({
      label: dayShort(b.date),
      value: b.amount,
    }));
  }, [reportQ.data]);

  const topSpendCategories = useMemo(() => {
    if (!reportQ.data) return [] as Array<[string, number]>;
    return Object.entries(reportQ.data.spending.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [reportQ.data]);

  if (reportQ.isLoading) return <Loading />;
  if (reportQ.error) return <ErrorView message={translateError(reportQ.error)} onRetry={() => reportQ.refetch()} />;

  const w: WeeklyReport = reportQ.data!;
  const hasAnything =
    w.schedule.total > 0 ||
    (w.tasks.byStatus && Object.keys(w.tasks.byStatus).length > 0) ||
    w.habits.target > 0 ||
    w.sleep.entries.length > 0 ||
    w.mood.entries.length > 0 ||
    w.spending.total > 0 ||
    w.goalProgress.length > 0;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('reports.weekly')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.weeklyRange', {
          from: formatDateByLocale(w.weekStart, { weekday: undefined }),
          to: formatDateByLocale(w.weekEnd, { weekday: undefined }),
        })}
      </Text>

      {!hasAnything ? (
        <EmptyState
          title={t('reports.weeklySections.empty.title')}
          description={t('reports.weeklySections.empty.description')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Schedule completion */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.weeklySections.schedule')}
            </Text>
            <Row
              label={t('reports.weeklySections.scheduleCompletion')}
              value={
                w.schedule.completionPercent !== null
                  ? `${w.schedule.completed}/${w.schedule.total} · ${w.schedule.completionPercent}%`
                  : '—'
              }
            />
            <View style={{ marginTop: spacing.md }}>
              <BarChart data={scheduleBars} height={96} tone="success" max={100} />
            </View>
          </Card>

          {/* Tasks + habits */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Card>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('reports.weeklySections.tasks')}
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {w.tasks.byStatus['COMPLETED'] ?? 0}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {t('reports.weeklySections.tasksCompleted')}
                </Text>
              </Card>
            </View>
            <View style={{ flex: 1 }}>
              <Card>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('reports.weeklySections.habits')}
                </Text>
                <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xs }]}>
                  {w.habits.consistencyPercent !== null ? `${w.habits.consistencyPercent}%` : '—'}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {t('reports.weeklySections.habitsConsistency')}
                </Text>
              </Card>
            </View>
          </View>

          {/* Sleep + mood */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.weeklySections.sleepMood')}
            </Text>
            <Row
              label={t('reports.weeklySections.sleepAvg')}
              value={
                w.sleep.averageMinutes !== null
                  ? `${Math.floor(w.sleep.averageMinutes / 60)}h ${w.sleep.averageMinutes % 60}m`
                  : '—'
              }
            />
            <Row
              label={t('reports.weeklySections.nightsLogged')}
              value={String(w.sleep.entries.length)}
            />
            <Row
              label={t('reports.weeklySections.moodLogged')}
              value={String(w.mood.entries.length)}
            />
          </Card>

          {/* Meal consistency */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.weeklySections.meals')}
            </Text>
            <Row
              label={t('reports.weeklySections.mealDaysLogged')}
              value={`${w.meals.daysLogged}/7`}
            />
            <Row
              label={t('reports.weeklySections.mealsTotal')}
              value={String(w.meals.total)}
            />
          </Card>

          {/* Spending */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.weeklySections.spending')}
            </Text>
            <Row
              label={t('reports.weeklySections.totalSpending')}
              value={formatMoneyByLocale(w.spending.total)}
            />
            <View style={{ marginTop: spacing.md }}>
              <BarChart data={spendingBars} height={96} tone="warning" />
            </View>
            {topSpendCategories.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                  {t('reports.weeklySections.topCategories')}
                </Text>
                {topSpendCategories.map(([cat, amount]) => (
                  <Row key={cat} label={cat} value={formatMoneyByLocale(amount)} />
                ))}
              </View>
            ) : null}
          </Card>

          {/* Budget warnings */}
          {w.budgetWarnings.length > 0 ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.weeklySections.budgetWarnings')}
              </Text>
              {w.budgetWarnings.map((b) => {
                const tone =
                  b.usedPercent >= 100 ? 'danger' : b.overThreshold ? 'warning' : 'neutral';
                return (
                  <View key={b.id} style={{ paddingVertical: spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text }}>{b.category}</Text>
                      <Badge tone={tone}>{`${b.usedPercent}%`}</Badge>
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {formatMoneyByLocale(b.used)} / {formatMoneyByLocale(b.amount)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* Goal progress */}
          {w.goalProgress.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('reports.weeklySections.goalProgress')}
              </Text>
              {w.goalProgress.slice(0, 5).map((g) => (
                <ProgressCard
                  key={g.id}
                  title={g.title}
                  current={g.percent ?? 0}
                  target={100}
                  currentLabel={g.percent !== null ? `${g.percent}%` : '—'}
                  tone={g.behindDeadline ? 'warning' : 'default'}
                />
              ))}
            </View>
          ) : null}

          {/* AI insight */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                {t('reports.weeklySections.aiInsight')}
              </Text>
              {aiInsight ? <Badge tone="primary">AI</Badge> : null}
            </View>
            {!aiInsight ? (
              <Button
                title={aiMut.isPending ? t('common.loading') : t('reports.weeklySections.generateInsight')}
                onPress={() => aiMut.mutate()}
                disabled={aiMut.isPending}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{aiInsight.summary}</Text>
                <InsightList title={t('reports.wins')} items={aiInsight.goodPoints} />
                <InsightList title={t('reports.issues')} items={aiInsight.improvementPoints} />
                <InsightList title={t('reports.weeklySections.nextWeek')} items={aiInsight.nextWeekSuggestions} />
                <Button
                  title={aiMut.isPending ? t('common.loading') : t('reports.regenerate')}
                  variant="ghost"
                  size="sm"
                  onPress={() => aiMut.mutate()}
                  disabled={aiMut.isPending}
                />
              </View>
            )}
            <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {t('reports.disclaimer')}
            </Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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

function InsightList({ title, items }: { title: string; items: string[] }) {
  const { colors, spacing, typography } = useTheme();
  if (!items || items.length === 0) return null;
  return (
    <View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {title}
      </Text>
      {items.map((s, i) => (
        <Text key={i} style={{ color: colors.text, marginTop: 2 }}>
          • {s}
        </Text>
      ))}
    </View>
  );
}
