import React, { useState } from 'react';
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
  Screen,
  Card,
  Badge,
  Loading,
  ErrorView,
  EmptyState,
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
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const q = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });

  // Drives the "Enable AI" hero card — when the user has zero providers
  // we surface the consumer-grade fast path instead of waiting for them
  // to discover Settings → AI provider on their own.
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

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
      style={{ flex: 1, backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Round 18 — email verification banner. Renders nothing when the
          signed-in user is already verified. */}
      <EmailVerifyBanner />

      {/* 1. GREETING */}
      <GreetingCard data={data} userEmail={user?.email} />

      {/* 1a. AI-NOT-CONFIGURED CTA — only when user has zero providers.
          Surfacing the consumer-grade fast path on Home means non-
          technical users discover it without digging through Settings. */}
      {providersQ.data && providersQ.data.length === 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <HeroCta
            title={t('dashboard.aiCta.title')}
            body={t('dashboard.aiCta.body')}
            cta={t('dashboard.aiCta.cta')}
            tone="primary"
            onPress={() => nav.navigate('AISetup')}
          />
        </View>
      ) : null}

      {/* 1b. QUICK CAPTURE ENTRY — universal "type one line, app routes
          it" surface. Works without an AI key thanks to the rule-based
          parser fallback (services/quickCapture/ruleParser.ts). */}
      <View style={{ marginTop: spacing.lg }}>
        <HeroCta
          title={t('dashboard.captureCta.title')}
          body={t('dashboard.captureCta.body')}
          cta={t('dashboard.captureCta.cta')}
          tone="surface"
          onPress={() => nav.navigate('QuickCapture')}
        />
      </View>

      {/* 2. ASSISTANT HIGHLIGHT */}
      <View style={{ marginTop: spacing.lg }}>
        {data.assistantHighlight ? (
          <RecommendationCard
            title={data.assistantHighlight.title}
            content={data.assistantHighlight.content}
            priority={data.assistantHighlight.priority}
            type={data.assistantHighlight.type}
          />
        ) : (
          <Card>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>
              {t('dashboard.assistantEmpty.title')}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
              {t('dashboard.assistantEmpty.description')}
            </Text>
          </Card>
        )}
      </View>

      {/* 3. TODAY PLAN SUMMARY */}
      <SectionHeader title={t('dashboard.todayPlan.title')} />
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
              <QuickButton
                label={t('dashboard.todayPlan.open')}
                onPress={() => nav.navigate('Main', { screen: 'Today' } as never)}
              />
              <QuickButton
                label={t('dashboard.todayPlan.regenerate')}
                onPress={() => generateSchedule.mutate()}
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
            <QuickButton
              label={t('dashboard.todayPlan.generate')}
              onPress={() => generateSchedule.mutate()}
              loading={generateSchedule.isPending}
            />
          </>
        )}
      </Card>

      {/* 4. FINANCE SUMMARY */}
      <SectionHeader
        title={t('dashboard.finance.title')}
        onViewMore={() => nav.navigate('Main', { screen: 'Finance' } as never)}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
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
      {data.finance.budgetWarnings.length > 0 && (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {data.finance.budgetWarnings.map((b) => (
            <Card key={b.category}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <Badge tone={b.usedPercent >= 100 ? 'danger' : 'warning'}>
                  {`${b.usedPercent}%`}
                </Badge>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{b.category}</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {formatMoneyByLocale(b.spent, data.finance.currency)} /{' '}
                {formatMoneyByLocale(b.amount, data.finance.currency)}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {/* 5. HEALTH / LIFESTYLE */}
      <SectionHeader title={t('dashboard.health.title')} />
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
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
        <View style={{ flex: 1 }}>
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
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('dashboard.health.meals')}
            value={`${data.health.meals.logged}/${data.health.meals.planned || '—'}`}
            subtitle={data.health.meals.nextPlanned ?? undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <InsightCard
            title={t('dashboard.health.habits')}
            value={`${data.health.habits.completed}/${data.health.habits.active || '—'}`}
            subtitle={`${data.scores.habitConsistencyRate ?? '—'}% · 7d`}
          />
        </View>
      </View>

      {/* 6. TASKS */}
      <SectionHeader
        title={t('dashboard.tasks.title')}
        onViewMore={() => nav.navigate('Tasks')}
      />
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
            {data.tasks.top.map((t) => (
              <View
                key={t.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                <Badge tone={t.priority === 'HIGH' ? 'danger' : 'neutral'}>{t.priority}</Badge>
                <Text
                  style={{
                    color: colors.text,
                    flex: 1,
                    textDecorationLine: t.status === 'COMPLETED' ? 'line-through' : 'none',
                  }}
                  numberOfLines={1}
                >
                  {t.title}
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

      {/* 7. GOALS */}
      <SectionHeader
        title={t('dashboard.goals.title')}
        onViewMore={() => nav.navigate('PersonalGoals')}
      />
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

      {/* 8. QUICK ACTIONS */}
      <SectionHeader title={t('dashboard.quickActions.title')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <QuickAction icon="⚡" label={t('dashboard.quickActions.quickCapture')} onPress={() => nav.navigate('QuickCapture')} />
        <QuickAction icon="💸" label={t('dashboard.quickActions.addExpense')} onPress={() => nav.navigate('AddExpense')} />
        <QuickAction icon="✅" label={t('dashboard.quickActions.addTask')} onPress={() => nav.navigate('CreateTask')} />
        <QuickAction icon="🙂" label={t('dashboard.quickActions.checkinMood')} onPress={() => nav.navigate('SleepMoodCheckin')} />
        <QuickAction
          icon="🗓"
          label={t('dashboard.quickActions.generateSchedule')}
          onPress={() => generateSchedule.mutate()}
        />
        <QuickAction icon="✨" label={t('dashboard.quickActions.askAI')} onPress={() => nav.navigate('AIChat')} />
      </View>
    </ScrollView>
  );
}

// ----- helpers --------------------------------------------------------------

function GreetingCard({ data, userEmail }: { data: DashboardSummary; userEmail?: string }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const hour = new Date().getHours();
  const greetingKey =
    hour < 11 ? 'dashboard.greeting.morning' : hour < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
  const name = data.greeting.displayName || userEmail?.split('@')[0] || '';
  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {formatDateByLocale(data.date)}
      </Text>
      <Text style={[typography.display, { color: colors.text, marginTop: spacing.xs }]}>
        {t(greetingKey, { name })}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
        {t('dashboard.greeting.subtitle', {
          tasksToday: data.tasks.todayTotal,
          habits: data.health.habits.active,
        })}
      </Text>
    </Card>
  );
}

function SectionHeader({ title, onViewMore }: { title: string; onViewMore?: () => void }) {
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
      {onViewMore ? (
        <TouchableOpacity onPress={onViewMore}>
          <Text style={[typography.caption, { color: colors.primary }]}>
            {t('common.viewMore')}
          </Text>
        </TouchableOpacity>
      ) : null}
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

function QuickButton({
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

function HeroCta({
  title,
  body,
  cta,
  tone,
  onPress,
}: {
  title: string;
  body: string;
  cta: string;
  tone: 'primary' | 'surface';
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const isPrimary = tone === 'primary';
  const bg = isPrimary ? colors.primary : colors.surface;
  const fg = isPrimary ? colors.textInverse : colors.text;
  const sub = isPrimary ? colors.textInverse : colors.textMuted;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: bg,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text style={[typography.h3, { color: fg }]}>{title}</Text>
      <Text style={[typography.body, { color: sub, marginTop: spacing.xs }]}>{body}</Text>
      <Text
        style={[
          typography.bodyStrong,
          {
            color: isPrimary ? colors.textInverse : colors.primary,
            marginTop: spacing.md,
          },
        ]}
      >
        {cta} →
      </Text>
    </TouchableOpacity>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: '30%',
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text
        style={[typography.small, { color: colors.text, marginTop: spacing.xs, textAlign: 'center' }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
