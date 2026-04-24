import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Button,
  Chip,
  Loading,
  ErrorView,
  EmptyState,
} from '../../components/ui';
import {
  assistantApi,
  type Recommendation,
  type AssistantSnapshot,
  type RecommendationStatus,
} from '../../services/api/assistant.api';
import { aiApi } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatTimeByLocale, todayIso } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_GROUPS = ['ALL', 'SCHEDULE', 'TASK', 'HABIT', 'MEAL', 'HEALTH', 'FINANCE', 'GOAL'] as const;
type TypeFilter = (typeof TYPE_GROUPS)[number];

const PRIORITY_GROUPS = ['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const;
type PriorityFilter = (typeof PRIORITY_GROUPS)[number];

const TYPE_TO_GROUP: Record<string, Exclude<TypeFilter, 'ALL'>> = {
  SCHEDULE: 'SCHEDULE',
  TASK: 'TASK',
  HABIT: 'HABIT',
  MEAL: 'MEAL',
  SLEEP: 'HEALTH',
  HEALTH: 'HEALTH',
  FINANCE: 'FINANCE',
  BUDGET: 'FINANCE',
  GOAL: 'GOAL',
  GENERAL: 'TASK',
};

function groupForType(t: string): Exclude<TypeFilter, 'ALL'> {
  return TYPE_TO_GROUP[t] ?? 'TASK';
}

export function AssistantScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const notifiedRef = useRef<Set<string>>(new Set());

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');

  const snapshot = useQuery({
    queryKey: ['assistant', 'today'],
    queryFn: () => assistantApi.today(),
  });

  const runMonitoring = useMutation({
    mutationFn: () => assistantApi.runDailyMonitoring(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant'] });
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const reviewMut = useMutation({
    mutationFn: () => assistantApi.generateDailyReview(todayIso()),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
    onSuccess: (res) => {
      const r = res.review;
      const summary = r.todaySummary;
      const wins = r.wins.length > 0 ? `\n\n${t('reports.wins')}:\n• ${r.wins.join('\n• ')}` : '';
      const tomorrow =
        r.suggestionsForTomorrow.length > 0
          ? `\n\n${t('reports.tomorrow')}:\n• ${r.suggestionsForTomorrow.join('\n• ')}`
          : '';
      Alert.alert(t('assistant.review.doneTitle'), `${summary}${wins}${tomorrow}`, [
        { text: t('common.ok') },
        {
          text: t('assistant.review.openFull'),
          onPress: () => nav.navigate('DailyReview'),
        },
      ]);
    },
  });

  const patchStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecommendationStatus }) =>
      assistantApi.patchStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assistant'] }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  // Filter recommendations (ACTIVE = NEW | VIEWED, drop APPLIED / DISMISSED).
  const visibleRecs = useMemo<Recommendation[]>(() => {
    const all = snapshot.data?.recommendations ?? [];
    const active = all.filter((r) => r.status !== 'APPLIED' && r.status !== 'DISMISSED');
    return active.filter((r) => {
      if (typeFilter !== 'ALL' && groupForType(r.type) !== typeFilter) return false;
      if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
      return true;
    });
  }, [snapshot.data?.recommendations, typeFilter, priorityFilter]);

  // Surface high-priority, never-notified recs as a local OS notification so
  // they reach the user even outside the app. Silently no-ops if permissions
  // were declined — nothing blocks the UI.
  useEffect(() => {
    const recs = snapshot.data?.recommendations ?? [];
    const pendingHigh = recs.filter(
      (r) =>
        r.priority === 'HIGH' &&
        (r.status === 'NEW' || r.status === 'VIEWED') &&
        !notifiedRef.current.has(r.id),
    );
    if (pendingHigh.length === 0) return;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        for (const rec of pendingHigh) {
          notifiedRef.current.add(rec.id);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: rec.title,
              body: rec.content,
              data: { recommendationId: rec.id, type: rec.type },
            },
            trigger: null,
          });
        }
      } catch {
        // Notifications are best-effort; nothing to surface on failure.
      }
    })();
  }, [snapshot.data?.recommendations]);

  function navigateForType(type: string) {
    const group = groupForType(type);
    switch (group) {
      case 'SCHEDULE':
        nav.navigate('Main' as never);
        break;
      case 'TASK':
        nav.navigate('Tasks');
        break;
      case 'HABIT':
        nav.navigate('Habits');
        break;
      case 'MEAL':
        nav.navigate('Meals');
        break;
      case 'HEALTH':
        nav.navigate('Health');
        break;
      case 'FINANCE':
        nav.navigate('Main' as never);
        break;
      case 'GOAL':
        nav.navigate('PersonalGoals');
        break;
    }
  }

  function confirmApply(r: Recommendation) {
    Alert.alert(t('assistant.confirmApply.title'), t('assistant.confirmApply.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('assistant.action.apply'),
        onPress: () => patchStatusMut.mutate({ id: r.id, status: 'APPLIED' }),
      },
    ]);
  }

  async function askAi(r: Recommendation) {
    try {
      const message = t('assistant.ai.askPrompt', { title: r.title, content: r.content });
      const res = await aiApi.chat({ message, contextType: 'assistant-recommendation' });
      Alert.alert(t('assistant.ai.answerTitle'), res.reply.answer, [{ text: t('common.ok') }]);
      // Viewing implicitly marks as engaged — move NEW → VIEWED so today's
      // summary count reflects reality.
      if (r.status === 'NEW') {
        patchStatusMut.mutate({ id: r.id, status: 'VIEWED' });
      }
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    }
  }

  function onView(r: Recommendation) {
    Alert.alert(r.title, r.content, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('assistant.action.open'), onPress: () => navigateForType(r.type) },
    ]);
    if (r.status === 'NEW') {
      patchStatusMut.mutate({ id: r.id, status: 'VIEWED' });
    }
  }

  if (snapshot.isLoading && !snapshot.data) return <Loading />;
  if (snapshot.error && !snapshot.data) {
    return <ErrorView message={translateError(snapshot.error)} onRetry={() => snapshot.refetch()} />;
  }

  const snap = snapshot.data!;
  const headline = buildHeadline(snap, t);
  const highCount = visibleRecs.filter((r) => r.priority === 'HIGH').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={snapshot.isRefetching} onRefresh={() => snapshot.refetch()} />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={[typography.display, { color: colors.text }]}>
          {t('assistant.title')}
        </Text>
        <TouchableOpacity onPress={() => snapshot.refetch()}>
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>
            {snapshot.isRefetching ? t('common.loading') : t('assistant.refresh')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        {t('assistant.subtitle')}
      </Text>

      {/* Today summary */}
      <Card>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
          {t('assistant.summary.title')} ·{' '}
          {formatDateByLocale(snap.date, { weekday: 'long' })}
        </Text>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{headline}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <Badge tone="neutral">
            {t('assistant.summary.activeRecs', { count: visibleRecs.length })}
          </Badge>
          {highCount > 0 ? (
            <Badge tone="danger">
              {t('assistant.summary.highPriority', { count: highCount })}
            </Badge>
          ) : null}
          {snap.patterns.overload.overloadedDays > 0 ? (
            <Badge tone="warning">
              {t('assistant.summary.overloaded', {
                count: snap.patterns.overload.overloadedDays,
              })}
            </Badge>
          ) : null}
        </View>
      </Card>

      {/* Actions */}
      <Card>
        <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
          {t('assistant.actions.title')}
        </Text>
        <Text style={[typography.small, { color: colors.textMuted, marginBottom: spacing.md }]}>
          {t('assistant.actions.body')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button
            title={runMonitoring.isPending ? t('common.loading') : t('assistant.actions.runDaily')}
            onPress={() => runMonitoring.mutate()}
            disabled={runMonitoring.isPending}
          />
          <Button
            title={reviewMut.isPending ? t('common.loading') : t('assistant.actions.generateReview')}
            variant="secondary"
            onPress={() => reviewMut.mutate()}
            disabled={reviewMut.isPending}
          />
        </View>
      </Card>

      {/* Filters */}
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {t('assistant.filters.type')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.lg }}
        >
          {TYPE_GROUPS.map((g) => (
            <Chip
              key={g}
              label={
                g === 'ALL' ? t('assistant.filters.all') : t(`assistant.type.${g}`)
              }
              selected={typeFilter === g}
              onPress={() => setTypeFilter(g)}
            />
          ))}
        </ScrollView>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {t('assistant.filters.priority')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {PRIORITY_GROUPS.map((p) => (
            <Chip
              key={p}
              label={
                p === 'ALL'
                  ? t('assistant.filters.all')
                  : t(`assistant.priority.${p}`)
              }
              selected={priorityFilter === p}
              onPress={() => setPriorityFilter(p)}
            />
          ))}
        </View>
      </View>

      {/* Recommendation list */}
      <Text style={[typography.h2, { color: colors.text, marginTop: spacing.sm }]}>
        {t('assistant.recommendations')}
      </Text>
      {visibleRecs.length === 0 ? (
        <EmptyState
          title={t('assistant.empty.title')}
          description={t('assistant.empty.description')}
        />
      ) : (
        visibleRecs.map((r) => (
          <RecommendationRow
            key={r.id}
            rec={r}
            onView={() => onView(r)}
            onApply={() => confirmApply(r)}
            onDismiss={() => patchStatusMut.mutate({ id: r.id, status: 'DISMISSED' })}
            onAskAi={() => askAi(r)}
            busy={patchStatusMut.isPending}
          />
        ))
      )}

      {/* Patterns at the bottom — supporting context, not primary. */}
      <Card>
        <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
          {t('assistant.patterns.title')}
        </Text>
        <PatternRow
          label={t('assistant.patterns.bestHour')}
          value={snap.patterns.productivity.bestHourBucket ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.bestHabit')}
          value={snap.patterns.habits.bestHabit ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.worstHabit')}
          value={snap.patterns.habits.worstHabit ?? '—'}
        />
        <PatternRow
          label={t('assistant.patterns.overloadedDays')}
          value={String(snap.patterns.overload.overloadedDays)}
        />
      </Card>
    </ScrollView>
  );
}

function RecommendationRow({
  rec,
  onView,
  onApply,
  onDismiss,
  onAskAi,
  busy,
}: {
  rec: Recommendation;
  onView: () => void;
  onApply: () => void;
  onDismiss: () => void;
  onAskAi: () => void;
  busy: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const group = groupForType(rec.type);
  const priorityTone =
    rec.priority === 'HIGH' ? 'danger' : rec.priority === 'MEDIUM' ? 'warning' : 'neutral';

  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          marginBottom: spacing.xs,
          flexWrap: 'wrap',
        }}
      >
        <Badge tone="neutral">{t(`assistant.type.${group}`)}</Badge>
        <Badge tone={priorityTone}>{t(`assistant.priority.${rec.priority}`)}</Badge>
        {rec.status === 'NEW' ? <Badge tone="info">{t('assistant.badge.new')}</Badge> : null}
      </View>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{rec.title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {rec.content}
      </Text>
      <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
        {formatDateByLocale(rec.createdAt, { weekday: undefined })} ·{' '}
        {formatTimeByLocale(rec.createdAt)}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.md,
        }}
      >
        <ActionButton label={t('assistant.action.view')} onPress={onView} disabled={busy} />
        <ActionButton
          label={t('assistant.action.apply')}
          onPress={onApply}
          disabled={busy}
          tone="primary"
        />
        <ActionButton label={t('assistant.action.askAi')} onPress={onAskAi} disabled={busy} />
        <ActionButton
          label={t('assistant.action.dismiss')}
          onPress={onDismiss}
          disabled={busy}
          tone="muted"
        />
      </View>
    </Card>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'muted';
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette =
    tone === 'primary'
      ? { bg: colors.primary, fg: '#FFFFFF', border: colors.primary }
      : tone === 'muted'
        ? { bg: 'transparent', fg: colors.textMuted, border: colors.border }
        : { bg: 'transparent', fg: colors.text, border: colors.border };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={[typography.caption, { color: palette.fg, fontWeight: '600' }]}>{label}</Text>
    </TouchableOpacity>
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

/**
 * Compose a gentle, human headline from the snapshot. Prefers real signals
 * (overload, rising spending, stalled goals) over a generic "on track".
 * Tone: kind, observational, never judgmental.
 */
function buildHeadline(
  snap: AssistantSnapshot,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const recs = snap.recommendations.filter(
    (r) => r.status !== 'APPLIED' && r.status !== 'DISMISSED',
  );
  const high = recs.filter((r) => r.priority === 'HIGH').length;
  const medium = recs.filter((r) => r.priority === 'MEDIUM').length;

  if (high > 0) {
    return t('assistant.summary.headlineHigh', { count: high });
  }
  if (snap.patterns.spending.risingCategory) {
    return t('assistant.summary.headlineSpending', {
      category: snap.patterns.spending.risingCategory.category,
    });
  }
  if (snap.patterns.overload.overloadedDays > 0) {
    return t('assistant.summary.headlineOverload', {
      count: snap.patterns.overload.overloadedDays,
    });
  }
  if (medium > 0) {
    return t('assistant.summary.headlineMedium', { count: medium });
  }
  if (recs.length === 0) {
    return t('assistant.summary.headlineOnTrack');
  }
  return t('assistant.summary.headlineSomeAttention', { count: recs.length });
}
