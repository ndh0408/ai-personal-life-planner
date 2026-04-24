import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Screen,
  Card,
  Badge,
  Button,
  Loading,
  ErrorView,
  EmptyState,
} from '../../components/ui';
import { reportsApi, type DailyReport } from '../../services/api/reports.api';
import { assistantApi, type DailyReviewOutput } from '../../services/api/assistant.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatMoneyByLocale, todayIso } from '../../utils/format';

function formatSleepHours(minutes: number | null | undefined, t: (key: string) => string): string {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}${t('reports.dailySections.hoursShort')}${rem > 0 ? ` ${rem}${t('reports.dailySections.minShort')}` : ''}`;
}

export function DailyReviewScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const [aiReview, setAiReview] = useState<DailyReviewOutput | null>(null);
  const date = todayIso();

  const reportQ = useQuery({
    queryKey: ['reports', 'daily', date],
    queryFn: () => reportsApi.daily(date),
  });

  const aiMut = useMutation({
    mutationFn: () => assistantApi.generateDailyReview(date),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
    onSuccess: (res) => setAiReview(res.review),
  });

  if (reportQ.isLoading) return <Loading />;
  if (reportQ.error) return <ErrorView message={translateError(reportQ.error)} onRetry={() => reportQ.refetch()} />;

  const d: DailyReport = reportQ.data!;
  const hasSchedule = d.schedule && d.schedule.items.total > 0;
  const taskDone = d.tasks.byStatus['COMPLETED'] ?? 0;
  const taskOverdue = d.tasks.overdue;
  const hasNothing =
    !hasSchedule &&
    d.tasks.total === 0 &&
    d.habits.logged === 0 &&
    !d.sleep &&
    !d.mood &&
    d.meals.count === 0 &&
    d.spending.total === 0;

  return (
    <Screen scroll>
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('reports.daily')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.dailyDescription')}
      </Text>

      {hasNothing ? (
        <EmptyState
          title={t('reports.dailySections.empty.title')}
          description={t('reports.dailySections.empty.description')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Schedule + tasks */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.dailySections.wins')}
            </Text>
            <Row
              label={t('reports.dailySections.scheduleDone')}
              value={
                hasSchedule
                  ? `${d.schedule!.items.completed}/${d.schedule!.items.total}`
                  : '—'
              }
            />
            <Row label={t('reports.dailySections.tasksDone')} value={`${taskDone}/${d.tasks.total}`} />
            <Row label={t('reports.dailySections.habitsDone')} value={`${d.habits.completed}/${d.habits.active}`} />
          </Card>

          {/* Issues */}
          {(taskOverdue > 0 || (hasSchedule && d.schedule!.items.total > d.schedule!.items.completed)) ? (
            <Card>
              <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('reports.dailySections.issues')}
              </Text>
              {taskOverdue > 0 ? (
                <Text style={{ color: colors.textMuted }}>
                  • {t('reports.dailySections.overdueTasks', { count: taskOverdue })}
                </Text>
              ) : null}
              {hasSchedule && d.schedule!.items.total > d.schedule!.items.completed ? (
                <Text style={{ color: colors.textMuted }}>
                  •{' '}
                  {t('reports.dailySections.unfinishedSchedule', {
                    count: d.schedule!.items.total - d.schedule!.items.completed,
                  })}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {/* Meals */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.dailySections.meals')}
            </Text>
            {d.meals.count === 0 ? (
              <Text style={{ color: colors.textMuted }}>{t('reports.dailySections.noMeals')}</Text>
            ) : (
              <>
                <Row
                  label={t('reports.dailySections.mealsLogged')}
                  value={`${d.meals.count}`}
                />
                {d.meals.totalCalories > 0 ? (
                  <Row
                    label={t('reports.dailySections.calories')}
                    value={`${d.meals.totalCalories} kcal`}
                  />
                ) : null}
                {d.meals.totalCost > 0 ? (
                  <Row
                    label={t('reports.dailySections.mealsCost')}
                    value={formatMoneyByLocale(d.meals.totalCost)}
                  />
                ) : null}
              </>
            )}
          </Card>

          {/* Sleep + mood */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.dailySections.sleepMood')}
            </Text>
            <Row
              label={t('reports.dailySections.sleep')}
              value={d.sleep ? formatSleepHours(d.sleep.durationMinutes, t) : '—'}
            />
            <Row
              label={t('reports.dailySections.sleepQuality')}
              value={d.sleep ? t(`health.sleepSummary.quality.${d.sleep.quality}`) : '—'}
            />
            <Row
              label={t('reports.dailySections.mood')}
              value={d.mood ? t(`checkin.moods.${d.mood.mood}`) : '—'}
            />
            <Row
              label={t('reports.dailySections.energy')}
              value={d.mood ? t(`checkin.levels.${d.mood.energyLevel}`) : '—'}
            />
          </Card>

          {/* Spending */}
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('reports.dailySections.spending')}
            </Text>
            {d.spending.total === 0 ? (
              <Text style={{ color: colors.textMuted }}>{t('reports.dailySections.noSpending')}</Text>
            ) : (
              <>
                <Row
                  label={t('reports.dailySections.totalSpending')}
                  value={formatMoneyByLocale(d.spending.total)}
                />
                {d.spending.topExpenses.length > 0 ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                      {t('reports.dailySections.topExpenses')}
                    </Text>
                    {d.spending.topExpenses.map((e, i) => (
                      <Text key={i} style={{ color: colors.text, marginBottom: 2 }}>
                        • {e.title} — {formatMoneyByLocale(e.amount)}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </Card>

          {/* AI narrative */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                {t('reports.dailySections.aiReview')}
              </Text>
              {aiReview ? <Badge tone="primary">AI</Badge> : null}
            </View>
            {!aiReview ? (
              <Button
                title={aiMut.isPending ? t('common.loading') : t('reports.generateDaily')}
                onPress={() => aiMut.mutate()}
                disabled={aiMut.isPending}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{aiReview.todaySummary}</Text>
                {aiReview.suggestionsForTomorrow.length > 0 ? (
                  <View>
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                      {t('reports.tomorrow')}
                    </Text>
                    {aiReview.suggestionsForTomorrow.map((s, i) => (
                      <Text key={i} style={{ color: colors.text, marginTop: 2 }}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                ) : null}
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
