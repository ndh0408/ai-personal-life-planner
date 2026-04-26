import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme, useResponsive } from '../../theme';
import {
  Screen,
  Card,
  Badge,
  Eyebrow,
  Loading,
  ErrorView,
  MoneyCard,
  ProgressCard,
  InsightCard,
  RecommendationCard,
} from '../../components/ui';
import { dashboardApi, type DashboardSummary } from '../../services/api/dashboard.api';
import { aiApi } from '../../services/api/ai.api';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale, formatMoneyByLocale, todayIso } from '../../utils/format';
import { useAuthStore } from '../../store/auth.store';
import { EmailVerifyBanner } from '../../components/auth/EmailVerifyBanner';
import { useAiGate } from '../../hooks/useAiEnabled';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Round 21 — Dashboard / Home screen restructured per UX spec §5.
 *
 * Vertical order:
 *   1. EmailVerifyBanner (only when unverified, dismiss-aware).
 *   2. Header — greeting + date + status chip ("Sẵn sàng" / "Cần chú ý" /
 *      "Chưa bật AI").
 *   3. Hero card — state-dependent CTA. AI not configured? Surface
 *      "Bật AI để bắt đầu". AI configured? Surface "Hôm nay bạn muốn
 *      làm gì?" with Generate-plan / Quick-capture buttons.
 *   4. Quick actions row — Quick capture, Add expense, Add task,
 *      Check-in, AI schedule, Ask AI. Responsive 2/3/4 columns.
 *   5. Today plan card.
 *   6. Money snapshot.
 *   7. Health / mood.
 *   8. Habits + goals.
 *   9. Top tasks.
 *
 * All sections gracefully degrade when their data is empty.
 */
export function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const { gridColumns, isTablet, atLeast } = useResponsive();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const guardAi = useAiGate();

  const q = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });

  const providersQ = useQuery({
    queryKey: QUERY_KEYS.aiProviders,
    queryFn: userAiProvidersApi.list,
    staleTime: 60_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const generateSchedule = useMutation({
    mutationFn: () => aiApi.generateSchedule({ date: todayIso() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  if (q.isLoading && !q.data) return <Loading />;
  if (q.error && !q.data) {
    return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  }
  const data = q.data!;
  const aiConfigured = (providersQ.data ?? []).length > 0;

  // ---- header status ------------------------------------------------------
  const overdue = data.tasks.overdue;
  const budgetWarn = data.finance.budgetWarnings.length > 0;
  const status: { tone: 'success' | 'warning' | 'info'; label: string } = !aiConfigured
    ? { tone: 'info', label: t('dashboard.status.aiOff') }
    : overdue > 0 || budgetWarn
      ? { tone: 'warning', label: t('dashboard.status.attention') }
      : { tone: 'success', label: t('dashboard.status.ready') };

  // ---- responsive container ----------------------------------------------
  const contentMaxWidth = isTablet ? 880 : undefined;
  const twoColumn = atLeast('md');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xxl * 2,
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
        }}
        style={{ flex: 1, backgroundColor: colors.bg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <EmailVerifyBanner />

        {/* 1. HEADER + status chip */}
        <Header
          name={data.greeting.displayName || user?.email?.split('@')[0] || ''}
          dateIso={data.date}
          statusTone={status.tone}
          statusLabel={status.label}
        />

        {/* 2. HERO — switches on AI-configured state. */}
        <View style={{ marginTop: spacing.lg }}>
          {!aiConfigured ? (
            <HeroCta
              tone="primary"
              title={t('dashboard.aiCta.title')}
              body={t('dashboard.aiCta.body')}
              cta={t('dashboard.aiCta.cta')}
              icon="sparkles"
              onPress={() => nav.navigate('AISetup')}
            />
          ) : (
            <HeroCta
              tone="surface"
              title={t('dashboard.heroReady.title')}
              body={t('dashboard.heroReady.body')}
              cta={
                data.todayPlan.hasSchedule
                  ? t('dashboard.heroReady.openPlan')
                  : t('dashboard.heroReady.generatePlan')
              }
              icon={data.todayPlan.hasSchedule ? 'calendar' : 'flash'}
              onPress={() => {
                if (data.todayPlan.hasSchedule) {
                  nav.navigate('Main', { screen: 'Today' } as never);
                } else {
                  if (!guardAi()) return;
                  generateSchedule.mutate();
                }
              }}
            />
          )}
        </View>

        {/* 3. QUICK ACTIONS — responsive grid */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <Eyebrow>{t('dashboard.quickActions.title')}</Eyebrow>
        </View>
        <QuickActionGrid
          columns={gridColumns}
          actions={[
            { icon: 'flash', label: t('dashboard.quickActions.quickCapture'), onPress: () => nav.navigate('QuickCapture') },
            { icon: 'cash', label: t('dashboard.quickActions.addExpense'), onPress: () => nav.navigate('AddExpense') },
            { icon: 'checkbox', label: t('dashboard.quickActions.addTask'), onPress: () => nav.navigate('CreateTask') },
            { icon: 'happy', label: t('dashboard.quickActions.checkinMood'), onPress: () => nav.navigate('SleepMoodCheckin') },
            {
              icon: 'calendar',
              label: t('dashboard.quickActions.generateSchedule'),
              onPress: () => {
                if (!guardAi()) return;
                generateSchedule.mutate();
              },
            },
            { icon: 'sparkles', label: t('dashboard.quickActions.askAI'), onPress: () => guardAi() && nav.navigate('AIChat') },
          ]}
        />

        {/* 4. ASSISTANT HIGHLIGHT */}
        {data.assistantHighlight ? (
          <View style={{ marginTop: spacing.xl }}>
            <RecommendationCard
              title={data.assistantHighlight.title}
              content={data.assistantHighlight.content}
              priority={data.assistantHighlight.priority}
              type={data.assistantHighlight.type}
            />
          </View>
        ) : null}

        {/* 5. TODAY PLAN */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <Eyebrow>{t('dashboard.todayPlan.title')}</Eyebrow>
        </View>
        <Card>
          {data.todayPlan.hasSchedule ? (
            <>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {t('dashboard.todayPlan.itemsLine', {
                  completed: data.todayPlan.completed,
                  total: data.todayPlan.items,
                })}
              </Text>
              {data.todayPlan.scheduleStatus ? (
                <View style={{ marginTop: spacing.xs }}>
                  <Badge tone="neutral">{data.todayPlan.scheduleStatus}</Badge>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <PillButton
                  label={t('dashboard.todayPlan.open')}
                  onPress={() => nav.navigate('Main', { screen: 'Today' } as never)}
                />
                <PillButton
                  label={t('dashboard.todayPlan.regenerate')}
                  onPress={() => guardAi() && generateSchedule.mutate()}
                  variant="secondary"
                  loading={generateSchedule.isPending}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
                {t('dashboard.todayPlan.none')}
              </Text>
              <PillButton
                label={t('dashboard.todayPlan.generate')}
                onPress={() => guardAi() && generateSchedule.mutate()}
                loading={generateSchedule.isPending}
              />
            </>
          )}
        </Card>

        {/* 6. MONEY SNAPSHOT */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <SectionRow
            title={t('dashboard.finance.title')}
            onViewMore={() => nav.navigate('Main', { screen: 'Finance' } as never)}
          />
        </View>
        <View
          style={{
            flexDirection: twoColumn ? 'row' : 'row',
            gap: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <MoneyCard
              label={t('dashboard.finance.income')}
              amount={data.finance.totalIncome}
              currency={data.finance.currency}
              tone="positive"
            />
          </View>
          <View style={{ flex: 1 }}>
            <MoneyCard
              label={t('dashboard.finance.expense')}
              amount={data.finance.totalExpense}
              currency={data.finance.currency}
              tone="warning"
            />
          </View>
        </View>
        <MoneyCard
          label={t('dashboard.finance.remaining')}
          amount={data.finance.remaining}
          currency={data.finance.currency}
          tone={data.finance.remaining >= 0 ? 'positive' : 'danger'}
          hint={t('dashboard.finance.cashHint', {
            amount: formatMoneyByLocale(data.finance.totalCash, data.finance.currency),
          })}
        />
        {data.finance.budgetWarnings.length > 0 ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {data.finance.budgetWarnings.map((b) => (
              <Card key={b.category}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Badge tone={b.usedPercent >= 100 ? 'danger' : 'warning'}>{`${b.usedPercent}%`}</Badge>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{b.category}</Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {formatMoneyByLocale(b.spent, data.finance.currency)} /{' '}
                  {formatMoneyByLocale(b.amount, data.finance.currency)}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* 7. HEALTH / LIFESTYLE */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <Eyebrow>{t('dashboard.health.title')}</Eyebrow>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <InsightCard
              title={t('dashboard.health.sleep')}
              value={
                data.health.sleepLatest
                  ? `${(data.health.sleepLatest.durationMinutes / 60).toFixed(1)}h`
                  : null
              }
              subtitle={data.health.sleepLatest?.quality ?? undefined}
            />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <InsightCard
              title={t('dashboard.health.mood')}
              value={data.health.moodToday?.mood ?? null}
              subtitle={
                data.health.moodToday
                  ? `${t('scores.energy')}: ${data.health.moodToday.energyLevel}`
                  : undefined
              }
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <InsightCard
              title={t('dashboard.health.meals')}
              value={`${data.health.meals.logged}/${data.health.meals.planned || '—'}`}
              subtitle={data.health.meals.nextPlanned ?? undefined}
            />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <InsightCard
              title={t('dashboard.health.habits')}
              value={`${data.health.habits.completed}/${data.health.habits.active || '—'}`}
              subtitle={`${data.scores.habitConsistencyRate ?? '—'}% · 7d`}
            />
          </View>
        </View>

        {/* 8. TASKS */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <SectionRow
            title={t('dashboard.tasks.title')}
            onViewMore={() => nav.navigate('Tasks')}
          />
        </View>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <TaskStat label={t('dashboard.tasks.today')} value={`${data.tasks.todayCompleted}/${data.tasks.todayTotal}`} />
            <TaskStat
              label={t('dashboard.tasks.overdue')}
              value={String(data.tasks.overdue)}
              danger={data.tasks.overdue > 0}
            />
            <TaskStat label={t('dashboard.tasks.highPriority')} value={String(data.tasks.highPriorityOpen)} />
          </View>
          {data.tasks.top.length > 0 ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {data.tasks.top.map((task) => (
                <View
                  key={task.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <Badge tone={task.priority === 'HIGH' ? 'danger' : 'neutral'}>{task.priority}</Badge>
                  <Text
                    style={{
                      color: colors.text,
                      flex: 1,
                      textDecorationLine: task.status === 'COMPLETED' ? 'line-through' : 'none',
                    }}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
              {t('dashboard.tasks.empty')}
            </Text>
          )}
        </Card>

        {/* 9. GOALS */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          <SectionRow
            title={t('dashboard.goals.title')}
            onViewMore={() => nav.navigate('PersonalGoals')}
          />
        </View>
        <View style={{ gap: spacing.md }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TaskStat label={t('dashboard.goals.active')} value={String(data.goals.activeTotal)} />
              <TaskStat
                label={t('dashboard.goals.behind')}
                value={String(data.goals.behind)}
                danger={data.goals.behind > 0}
              />
            </View>
          </Card>
          {data.goals.topSaving ? (
            <ProgressCard
              title={data.goals.topSaving.title}
              current={data.goals.topSaving.current}
              target={data.goals.topSaving.target}
              currentLabel={`${formatMoneyByLocale(data.goals.topSaving.current, data.finance.currency)} / ${formatMoneyByLocale(data.goals.topSaving.target, data.finance.currency)}`}
              subtitle={
                data.goals.topSaving.targetDate
                  ? `${t('savings.targetDate')}: ${formatDateByLocale(data.goals.topSaving.targetDate, { weekday: undefined })}`
                  : undefined
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

// ---------- helpers ---------------------------------------------------------

function Header({
  name,
  dateIso,
  statusTone,
  statusLabel,
}: {
  name: string;
  dateIso: string;
  statusTone: 'success' | 'warning' | 'info';
  statusLabel: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const hour = new Date().getHours();
  const greetingKey =
    hour < 11 ? 'dashboard.greeting.morning' : hour < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
  return (
    <View>
      {/* Date ledger row — italic serif date on the left, editorial
          status kicker on the right. The horizontal rule below ties
          them together like a column header on a magazine spread. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.italicAccent, { color: colors.textMuted }]}>
          {formatDateByLocale(dateIso)}
        </Text>
        <Badge tone={statusTone} variant="editorial">{statusLabel}</Badge>
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          opacity: 0.5,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      />
      {/* Greeting — display serif with a soft italic name pulled out
          on its own line so the eye lands on it the way a magazine
          drop-cap does. */}
      <Text style={[typography.display, { color: colors.text }]}>
        {t(`${greetingKey}Plain`)}
      </Text>
      {name ? (
        <Text
          style={[
            typography.displayItalic,
            { color: colors.primary, marginTop: 2 },
          ]}
        >
          {name}.
        </Text>
      ) : null}
    </View>
  );
}

function HeroCta({
  title,
  body,
  cta,
  tone,
  icon,
  onPress,
}: {
  title: string;
  body: string;
  cta: string;
  tone: 'primary' | 'surface';
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const isPrimary = tone === 'primary';
  const bg = isPrimary ? colors.primary : colors.surface;
  const fg = isPrimary ? colors.textInverse : colors.text;
  const sub = isPrimary ? colors.textInverse : colors.textMuted;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${cta}`}
      style={[
        {
          backgroundColor: bg,
          padding: spacing.xl,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: isPrimary ? 'transparent' : colors.border,
          overflow: 'hidden',
        },
        shadows.level2,
      ]}
    >
      {/* Editorial top rule — sienna accent that signals "this is the
          headline" the way a magazine pull-quote uses a thin gold rule. */}
      {!isPrimary ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isPrimary ? 'rgba(255, 252, 246, 0.22)' : colors.surfaceMuted,
            borderWidth: isPrimary ? 0 : 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={22} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h2, { color: fg }]}>{title}</Text>
          <Text
            style={[
              typography.body,
              { color: sub, marginTop: 4, opacity: isPrimary ? 0.92 : 1 },
            ]}
          >
            {body}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.lg,
        }}
      >
        <Text
          style={[
            typography.bodyStrong,
            {
              color: isPrimary ? colors.textInverse : colors.primary,
              letterSpacing: 0.3,
            },
          ]}
        >
          {cta}
        </Text>
        <Ionicons
          name="arrow-forward"
          size={16}
          color={isPrimary ? colors.textInverse : colors.primary}
        />
      </View>
    </TouchableOpacity>
  );
}

/**
 * Editorial section row — eyebrow on the left + a small "View more"
 * link on the right. Replaces the old SectionHeader for any section
 * that needs a CTA pair. Sections without a CTA use bare `<Eyebrow>`.
 */
function SectionRow({
  title,
  onViewMore,
}: {
  title: string;
  onViewMore?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, fonts } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Eyebrow style={{ marginBottom: 0, flex: 1 }}>{title}</Eyebrow>
      {onViewMore ? (
        <TouchableOpacity onPress={onViewMore} accessibilityRole="link">
          <Text
            style={{
              color: colors.primary,
              fontFamily: fonts.sansSemibold,
              fontSize: 12,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {t('common.viewMore')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickActionGrid({
  columns,
  actions,
}: {
  columns: 2 | 3 | 4;
  actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[];
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const cellWidth = `${100 / columns - 1.5}%` as const;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.label}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={{
            width: cellWidth,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            minHeight: 80,
            justifyContent: 'center',
          }}
        >
          <Ionicons name={a.icon} size={22} color={colors.primary} />
          <Text
            style={[typography.small, { color: colors.text, marginTop: spacing.xs, textAlign: 'center' }]}
            numberOfLines={2}
          >
            {a.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TaskStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[typography.h2, { color: danger ? colors.danger : colors.text }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function PillButton({
  label,
  onPress,
  variant = 'primary',
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const bg = variant === 'primary' ? colors.primary : colors.surface;
  const fg = variant === 'primary' ? colors.textInverse : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!loading }}
      style={{
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: colors.border,
        alignItems: 'center',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Text style={[typography.bodyStrong, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Keep DashboardSummary referenced for export consumers.
export type { DashboardSummary };
