import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '../../components/ui';
import { TimelineItem } from '../../components/planner/TimelineItem';

type Status = ScheduleItem['status'];
import { schedulesApi, type ScheduleItem } from '../../services/api/schedules.api';
import { aiApi } from '../../services/api/ai.api';
import { dashboardApi } from '../../services/api/dashboard.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import {
  formatDateByLocale,
  formatMoneyByLocale,
  formatTimeOfDay,
  todayIso,
} from '../../utils/format';
import { useOnline } from '../../hooks/useOnline';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function currentHhmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TodayScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const online = useOnline();
  const date = todayIso();

  const scheduleQ = useQuery({
    queryKey: QUERY_KEYS.schedule(date),
    queryFn: () => schedulesApi.byDate(date),
  });
  const dashboardQ = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([scheduleQ.refetch(), dashboardQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [scheduleQ, dashboardQ]);

  const generateMut = useMutation({
    mutationFn: () => aiApi.generateSchedule({ date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const rescheduleMut = useMutation({
    mutationFn: () =>
      aiApi.reschedule({
        date,
        currentTime: currentHhmm(),
        delayMinutes: 30,
      }),
    onSuccess: (r) => {
      Alert.alert(
        t('today.reschedule.previewTitle'),
        `${r.preview.summary}\n\n` +
          (r.preview.shortened.length
            ? `${t('today.reschedule.shortened')}: ${r.preview.shortened.length}\n`
            : '') +
          (r.preview.removed.length
            ? `${t('today.reschedule.removed')}: ${r.preview.removed.length}\n`
            : ''),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('today.reschedule.apply'),
            onPress: async () => {
              try {
                await aiApi.applyReschedule({ date, previewId: r.previewId });
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) });
              } catch (e) {
                Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
              }
            },
          },
        ],
      );
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const setStatusMut = useMutation({
    mutationFn: (vars: { id: string; status: ScheduleItem['status'] }) =>
      schedulesApi.setItemStatus(vars.id, vars.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(date) });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  /** Ask-confirm overwrite when a schedule already exists before regenerating. */
  function requestGenerate() {
    if (generateMut.isPending) return;
    if (scheduleQ.data) {
      Alert.alert(
        t('today.aiPlanner.confirmOverwriteTitle'),
        t('today.aiPlanner.confirmOverwriteBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('today.aiPlanner.generate'), onPress: () => generateMut.mutate() },
        ],
      );
      return;
    }
    generateMut.mutate();
  }

  if (scheduleQ.isLoading && !scheduleQ.data) return <Loading />;
  if (scheduleQ.error && !scheduleQ.data) {
    return <ErrorView message={translateError(scheduleQ.error)} onRetry={() => scheduleQ.refetch()} />;
  }

  const schedule = scheduleQ.data;
  const items = schedule?.items ?? [];
  const dash = dashboardQ.data;
  const aiBusy = generateMut.isPending || rescheduleMut.isPending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!online && (
        <View
          style={{
            backgroundColor: colors.warning + '22',
            borderColor: colors.warning,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ color: colors.warning, fontWeight: '700' }}>
            {t('offline.title')}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            {t('offline.description')}
          </Text>
        </View>
      )}

      {/* 1. HEADER + mood check-in */}
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {formatDateByLocale(date)}
        </Text>
        <Text style={[typography.display, { color: colors.text, marginTop: spacing.xs }]}>
          {t('today.title')}
        </Text>
      </View>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {dash?.health.moodToday
                ? `${t('today.moodToday')}: ${dash.health.moodToday.mood} · ${dash.health.moodToday.energyLevel}`
                : t('today.moodPromptTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {dash?.health.moodToday ? t('today.moodLogged') : t('today.moodPromptBody')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => nav.navigate('SleepMoodCheckin')}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: '700' }}>
              {t('today.checkinCta')}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 2. AI PLANNER */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>
          {t('today.aiPlanner.title')}
        </Text>
        {schedule?.summary ? (
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {schedule.summary}
          </Text>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {t('today.aiPlanner.body')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <ActionButton
            label={
              generateMut.isPending
                ? t('today.aiPlanner.pending')
                : schedule
                  ? t('today.aiPlanner.regenerate')
                  : t('today.aiPlanner.generate')
            }
            onPress={requestGenerate}
            disabled={aiBusy || !online}
            primary
          />
          <ActionButton
            label={
              rescheduleMut.isPending ? t('today.reschedule.pending') : t('today.aiPlanner.imLate')
            }
            onPress={() => rescheduleMut.mutate()}
            disabled={aiBusy || !online || !schedule}
          />
        </View>
      </Card>

      {/* 3. WAKE/SLEEP */}
      {schedule ? (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Card>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t('today.wakeTime')}
              </Text>
              <Text style={[typography.h1, { color: colors.text, marginTop: spacing.xs }]}>
                {formatTimeOfDay(schedule.wakeUpTime) || '—'}
              </Text>
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t('today.sleepTime')}
              </Text>
              <Text style={[typography.h1, { color: colors.text, marginTop: spacing.xs }]}>
                {formatTimeOfDay(schedule.sleepTime) || '—'}
              </Text>
            </Card>
          </View>
        </View>
      ) : null}

      {/* 4. TIMELINE */}
      <SectionHeader title={t('today.timeline')} />
      {items.length === 0 ? (
        <EmptyState
          title={t('today.empty.title')}
          description={t('today.empty.description')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((item, idx) => (
            <View key={item.id}>
              <TimelineItem
                startTime={item.startTime}
                endTime={item.endTime}
                title={item.title}
                description={item.description}
                type={item.type}
                status={item.status}
                isLast={idx === items.length - 1}
              />
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.xs,
                  marginTop: -spacing.xs,
                  marginLeft: spacing.xxl,
                  marginBottom: spacing.sm,
                }}
              >
                <ItemAction
                  label={
                    item.status === 'COMPLETED'
                      ? t('today.item.uncomplete')
                      : t('today.item.complete')
                  }
                  onPress={() =>
                    setStatusMut.mutate({
                      id: item.id,
                      status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
                    })
                  }
                  tone="success"
                />
                <ItemAction
                  label={t('today.item.skip')}
                  onPress={() => setStatusMut.mutate({ id: item.id, status: 'SKIPPED' })}
                />
                <ItemAction
                  label={t('today.item.delay')}
                  onPress={() => setStatusMut.mutate({ id: item.id, status: 'DELAYED' })}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {dash ? (
        <>
          {/* 5. TASK PREVIEW */}
          <SectionHeader title={t('today.tasksPreview')} onMore={() => nav.navigate('Tasks')} />
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Stat
                label={t('dashboard.tasks.today')}
                value={`${dash.tasks.todayCompleted}/${dash.tasks.todayTotal}`}
              />
              <Stat
                label={t('dashboard.tasks.overdue')}
                value={String(dash.tasks.overdue)}
                danger={dash.tasks.overdue > 0}
              />
              <Stat
                label={t('dashboard.tasks.highPriority')}
                value={String(dash.tasks.highPriorityOpen)}
              />
            </View>
            {dash.tasks.top.length > 0 ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {dash.tasks.top.map((task) => (
                  <View
                    key={task.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                  >
                    <Badge tone={task.priority === 'HIGH' ? 'danger' : 'neutral'}>
                      {task.priority}
                    </Badge>
                    <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                      {task.title}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          {/* 6. HABITS */}
          <SectionHeader title={t('today.habitsPreview')} onMore={() => nav.navigate('Habits')} />
          <Card>
            <Text style={{ color: colors.text }}>
              {t('today.habitsLine', {
                completed: dash.health.habits.completed,
                active: dash.health.habits.active,
              })}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {t('today.habitsConsistency', { pct: dash.scores.habitConsistencyRate ?? '—' })}
            </Text>
          </Card>

          {/* 7. MEALS */}
          <SectionHeader title={t('today.mealsPreview')} onMore={() => nav.navigate('Meals')} />
          <Card>
            <Text style={{ color: colors.text }}>
              {t('today.mealsLine', {
                logged: dash.health.meals.logged,
                planned: dash.health.meals.planned,
              })}
            </Text>
            {dash.health.meals.nextPlanned ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                {t('today.mealsNext')}: {dash.health.meals.nextPlanned}
              </Text>
            ) : null}
          </Card>

          {/* 8. FINANCE */}
          <SectionHeader
            title={t('today.financeReminder')}
            onMore={() => nav.navigate('Main', { screen: 'Finance' } as never)}
          />
          <Card>
            <Text style={{ color: colors.text }}>
              {t('today.remainingMonth')}:{' '}
              <Text style={{ fontWeight: '700' }}>
                {formatMoneyByLocale(dash.finance.remaining, dash.finance.currency)}
              </Text>
            </Text>
            {dash.finance.budgetWarnings.length > 0 ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {dash.finance.budgetWarnings.slice(0, 2).map((b) => (
                  <View key={b.category} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Badge tone={b.usedPercent >= 100 ? 'danger' : 'warning'}>
                      {`${b.usedPercent}%`}
                    </Badge>
                    <Text style={{ color: colors.text, flex: 1 }}>{b.category}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.md,
      }}
    >
      <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
      {onMore ? (
        <TouchableOpacity onPress={onMore}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('common.viewMore')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[typography.h2, { color: danger ? colors.danger : colors.text }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ItemAction({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'success';
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const fg = tone === 'success' ? colors.success : colors.textMuted;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: fg + '55',
      }}
    >
      <Text style={[typography.small, { color: fg, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.primary : colors.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={[
          typography.bodyStrong,
          { color: primary ? colors.textInverse : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
