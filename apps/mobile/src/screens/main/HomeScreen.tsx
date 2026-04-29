import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Card,
  Icon,
  InsightCard,
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { useCaptureConfirm, useCaptureParse } from '../../hooks/useCapture';
import { useFeedInvalidator, useTodayMeals } from '../../hooks/useFeed';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '../../services/api/profile.service';
import { useUpdateRecommendationStatus } from '../../hooks/useRecommendations';
import { QuickCaptureBar } from '../../components/quick-capture/QuickCaptureBar';
import { CapturePreviewSheet } from '../../components/quick-capture/CapturePreviewSheet';
import { HomeHero } from '../../components/home/HomeHero';
import { QuickActionsRow } from '../../components/home/QuickActionsRow';
import { SmartNudges } from '../../components/home/SmartNudges';
import { SmartBriefHero } from '../../components/home/SmartBriefHero';
import { SuggestedCapturesStrip } from '../../components/home/SuggestedCapturesStrip';
import { PrivacyLimitedCard } from '../../components/home/PrivacyLimitedCard';
import { InsightWhySheet } from '../../components/home/InsightWhySheet';
import type {
  SmartBriefAction,
  SuggestedCapture,
} from '../../services/api/dashboard.service';
import { captureService, type CaptureParseResponse } from '../../services/api/capture.service';
import { formatMoney } from '../../utils/format';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { t, i18n: { language } } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const [parsed, setParsed] = useState<CaptureParseResponse | null>(null);
  const [lastRawText, setLastRawText] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Round 37: rationale sheet for the top recommendation.
  const [whyOpen, setWhyOpen] = useState(false);

  const summary = useDashboardSummary();
  const meals = useTodayMeals();
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileService.get(),
    staleTime: 5 * 60_000,
  });
  const parse = useCaptureParse();
  const confirm = useCaptureConfirm();
  const invalidateFeed = useFeedInvalidator();
  const updateRec = useUpdateRecommendationStatus();

  const handleSend = (text: string) => {
    setLastRawText(text);
    parse.mutate(text, {
      onSuccess: (data) => {
        setParsed(data);
        setSheetOpen(true);
      },
      onError: () => toast.show(t('capture.errors.network'), 'danger'),
    });
  };

  const handleConfirm = (req: Parameters<typeof confirm.mutate>[0]) => {
    // Forward the original user text so the server can write a QuickCapture
    // audit row (powers "what did I capture today" later).
    const enriched = lastRawText ? { ...req, rawText: lastRawText } : req;
    confirm.mutate(enriched, {
      onSuccess: (res) => {
        setSheetOpen(false);
        setParsed(null);
        invalidateFeed();
        void summary.refetch();
        if (res.quickCaptureId) {
          toast.showWithAction(t('capture.saved'), {
            tone: 'success',
            action: {
              label: t('common.undo', { defaultValue: 'Hoàn tác' }),
              onPress: () => {
                captureService
                  .undo(res.quickCaptureId!)
                  .then(() => {
                    invalidateFeed();
                    void summary.refetch();
                    toast.show(t('capture.undone', { defaultValue: 'Đã hoàn tác' }), 'info');
                  })
                  .catch(() =>
                    toast.show(t('capture.errors.undoFailed', { defaultValue: 'Hoàn tác thất bại' }), 'danger'),
                  );
              },
            },
          });
        } else {
          toast.show(t('capture.saved'), 'success');
        }
      },
      onError: () => toast.show(t('capture.errors.network'), 'danger'),
    });
  };

  const greetingName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const todayLabel = new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const aiEnabled = summary.data?.aiEnabled ?? false;
  const isOffline = summary.isError && !summary.data;

  return (
    <>
      <AppScreen
        noBottomInset
        footer={<QuickCaptureBar busy={parse.isPending} onSend={handleSend} />}
        scroll={false}
        edgeToEdge
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={summary.isRefetching}
              onRefresh={() => summary.refetch()}
              tintColor={colors.accent.base}
              colors={[colors.accent.base]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <HomeHeader
            greetingName={greetingName}
            todayLabel={todayLabel}
            aiEnabled={aiEnabled}
          />

          {isOffline ? <OfflineBanner /> : null}

          {/* Round 32: command-center hero is the SmartBrief from the
              dashboard. The old HomeHero only handled "AI on / off" — the
              brief carries that state plus the salient signal. */}
          <SmartBriefHero
            brief={summary.data?.smartBrief ?? null}
            greetingName={greetingName}
            onAction={(action: SmartBriefAction) => {
              if (action.screen === 'Today') {
                navigation.getParent()?.navigate('MainTabs', { screen: 'Today' });
              } else if (action.screen === 'Money') {
                navigation.getParent()?.navigate('MainTabs', { screen: 'Money' });
              } else if (action.screen === 'Tasks') {
                navigation.navigate('Tasks');
              } else if (action.screen === 'MealLog') {
                navigation.navigate('MealLog');
              } else if (action.screen === 'SleepMoodCheckin') {
                navigation.navigate('SleepMoodCheckin');
              } else if (action.screen === 'AISettings') {
                navigation.navigate('AISettings');
              } else if (action.screen === 'Privacy') {
                navigation.navigate('Privacy');
              } else if (action.smartEntryMode) {
                navigation.navigate('SmartEntry', { mode: action.smartEntryMode });
              }
            }}
          />

          {/* AI-disabled fallback CTA — shown only when there's no AI key,
              since SmartBrief already handles the "got AI" path. */}
          {!aiEnabled ? (
            <View style={{ marginTop: spacing.md }}>
              <HomeHero
                aiEnabled={false}
                userName={greetingName}
                onAddKey={() => navigation.navigate('AISettings')}
                onCapture={() => navigation.navigate('SmartEntry', { mode: 'auto' })}
                onPlan={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Today' })}
              />
            </View>
          ) : null}

          {/* Round 32: tap a chip → SmartEntry pre-filled with the suggestion
              text + mode. User confirms via the existing preview. */}
          <SuggestedCapturesStrip
            suggestions={summary.data?.suggestedCaptures ?? []}
            onPress={(s: SuggestedCapture) =>
              navigation.navigate('SmartEntry', {
                mode: s.mode ?? 'auto',
                // SmartEntry doesn't yet read prefillText; landing on the
                // mode-specific surface already covers 80% of the value.
              } as { mode: typeof s.mode | 'auto' })
            }
          />

          {/* R23: quick actions are mode-specific. Each chip preselects a kind
              on SmartEntry, so "Chi tiêu" opens with EXPENSE chosen and the
              right editor; "auto" was creating four buttons that all opened
              the same screen. */}
          <QuickActionsRow
            actions={[
              { key: 'expense', onPress: () => navigation.navigate('SmartEntry', { mode: 'EXPENSE' }) },
              { key: 'task', onPress: () => navigation.navigate('SmartEntry', { mode: 'TASK' }) },
              { key: 'checkin', onPress: () => navigation.navigate('SleepMoodCheckin') },
              {
                key: 'askAi',
                onPress: () =>
                  navigation.getParent()?.navigate('MainTabs', { screen: 'Assistant' }),
                disabled: !aiEnabled,
              },
            ]}
          />

          {/* Round 32: privacy hint. Only renders when domains are hidden. */}
          <PrivacyLimitedCard
            domains={summary.data?.privacyLimitedDomains ?? []}
            onOpenPrivacy={() => navigation.navigate('Privacy')}
          />

          {summary.data ? (
            <SmartNudges
              usualWakeTime={profile.data?.usualWakeTime ?? null}
              mealsToday={meals.data?.total ?? 0}
              todaySpendVnd={summary.data.money?.todayTotal ?? 0}
              // Use weekTotal as a rough monthly proxy when monthly is unavailable.
              monthSpendVnd={summary.data.money?.weekTotal ?? 0}
              dayOfMonth={new Date().getDate()}
            />
          ) : null}

          {summary.isLoading && !summary.data ? (
            <LoadingState />
          ) : summary.data ? (
            <View style={{ gap: spacing.md }}>
              {(summary.data.homeOrder ?? ['plan', 'money', 'task', 'health']).map((cardKey) => {
                switch (cardKey) {
                  case 'plan':
                    return (
                      <TodayPlanCard
                        key={cardKey}
                        summary={summary.data!.todayPlan}
                        onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Today' })}
                      />
                    );
                  case 'money':
                    return (
                      <MoneyCard
                        key={cardKey}
                        summary={summary.data!.money}
                        onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Money' })}
                      />
                    );
                  case 'task':
                    return <NextTaskCard key={cardKey} task={summary.data!.nextTask} />;
                  case 'health':
                  case 'mood':
                    return <MoodSleepCard key={cardKey} summary={summary.data!.moodSleep} />;
                  default:
                    return null;
                }
              })}
              <NudgeCard
                nudge={summary.data.topRecommendation}
                onDismiss={(id) => updateRec.mutate({ id, status: 'DISMISSED' })}
                onApply={(id) => updateRec.mutate({ id, status: 'APPLIED' })}
                onWhyThis={() => setWhyOpen(true)}
              />
            </View>
          ) : null}
        </ScrollView>
      </AppScreen>

      {/* Round 37: rationale sheet for the topRecommendation. */}
      {summary.data?.topRecommendation ? (
        <InsightWhySheet
          visible={whyOpen}
          onClose={() => setWhyOpen(false)}
          title={summary.data.topRecommendation.title}
          explainText={summary.data.topRecommendation.explainText}
          evidence={summary.data.topRecommendation.evidence}
        />
      ) : null}

      <CapturePreviewSheet
        visible={sheetOpen}
        parsed={parsed}
        busy={confirm.isPending}
        onConfirm={handleConfirm}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function HomeHeader({
  greetingName,
  todayLabel,
  aiEnabled,
}: {
  greetingName: string;
  todayLabel: string;
  aiEnabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text variant="kicker">{todayLabel}</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 99,
            backgroundColor: aiEnabled ? colors.accent.soft : colors.surfaceAlt,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: aiEnabled ? colors.accent.base : colors.text.muted,
            }}
          />
          <Text
            variant="caption"
            style={{ color: aiEnabled ? colors.accent.base : colors.text.muted }}
          >
            {aiEnabled ? 'AI' : t('home.heroNoAi.cta')}
          </Text>
        </View>
      </View>
      <Text variant="display" style={{ marginTop: spacing.md }}>
        {t('home.greeting', { name: greetingName })}
      </Text>
    </View>
  );
}

function OfflineBanner() {
  const { t } = useTranslation();
  return (
    <View
      style={{
        backgroundColor: colors.status.warning + '22',
        borderColor: colors.status.warning,
        borderWidth: 1,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <Text variant="caption" style={{ color: colors.status.warning }}>
        {t('home.offlineBanner')}
      </Text>
    </View>
  );
}

function TodayPlanCard({
  summary,
  onPress,
}: {
  summary: { totalItems: number; doneItems: number; aiGenerated: boolean };
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card onPress={onPress}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="bodyEm">{t('home.cards.todayPlanTitle')}</Text>
        {summary.aiGenerated ? (
          <Text variant="caption" style={{ color: colors.accent.base, fontWeight: '700' }}>
            AI
          </Text>
        ) : null}
      </View>
      {summary.totalItems > 0 ? (
        <Text variant="number" style={{ fontSize: 22, lineHeight: 28 }}>
          {t('home.cards.todayPlanProgress', {
            done: summary.doneItems,
            total: summary.totalItems,
          })}
        </Text>
      ) : (
        <Text variant="caption">{t('home.cards.todayPlanEmpty')}</Text>
      )}
    </Card>
  );
}

function MoneyCard({
  summary,
  onPress,
}: {
  summary: { todayTotal: number; weekTotal: number; walletBalance: number };
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card onPress={onPress}>
      <Text variant="bodyEm">{t('home.cards.moneyTitle')}</Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <View>
          <Text variant="caption">{t('home.cards.moneyToday')}</Text>
          <Text variant="number" style={{ fontSize: 18, lineHeight: 22 }}>
            {formatMoney(summary.todayTotal)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="caption">{t('home.cards.moneyWallet')}</Text>
          <Text
            variant="number"
            style={{
              fontSize: 18,
              lineHeight: 22,
              color: summary.walletBalance < 0 ? colors.status.danger : colors.text.primary,
            }}
          >
            {formatMoney(summary.walletBalance)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function NextTaskCard({
  task,
}: {
  task: { id: string; title: string; dueAt: string | null; priority: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text variant="bodyEm">{t('home.cards.nextTaskTitle')}</Text>
      {task ? (
        <>
          <Text>{task.title}</Text>
          {task.dueAt ? (
            <Text variant="caption">
              {new Date(task.dueAt).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="caption">{t('home.cards.nextTaskEmpty')}</Text>
      )}
    </Card>
  );
}

interface NudgeCardProps {
  nudge:
    | {
        id: string;
        type: string;
        title: string;
        content: string;
        priority: string;
        explainText?: string | null;
        evidence?: Array<{
          label: string;
          value: string;
          source?: 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED';
        }>;
      }
    | null;
  onDismiss: (id: string) => void;
  onApply: (id: string) => void;
  onWhyThis?: () => void;
}

function NudgeCard({ nudge, onDismiss, onApply, onWhyThis }: NudgeCardProps) {
  const { t } = useTranslation();
  if (!nudge) {
    return (
      <Card>
        <Text variant="bodyEm">{t('home.cards.nudgeTitle')}</Text>
        <Text variant="caption">{t('home.cards.nudgeEmpty')}</Text>
      </Card>
    );
  }
  const tone =
    nudge.priority === 'HIGH'
      ? nudge.type === 'FINANCE' || nudge.type === 'TASK'
        ? 'danger'
        : 'warning'
      : nudge.priority === 'MEDIUM'
      ? 'info'
      : 'success';
  return (
    <View>
      <InsightCard
        title={`${t('home.cards.nudgeTitle')} — ${nudge.title}`}
        body={nudge.content}
        tone={tone as 'info' | 'success' | 'warning' | 'danger'}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 6 }}>
        {/* Round 37: "Why this?" button — opens the rationale sheet
            with explainText + evidence. Only renders when there's
            something to show. */}
        {onWhyThis && (nudge.explainText || (nudge.evidence && nudge.evidence.length > 0)) ? (
          <Pressable
            onPress={onWhyThis}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('insights.whyThis', { defaultValue: 'Vì sao có gợi ý này?' })}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" style={{ color: colors.text.muted, fontWeight: '700' }}>
              {t('insights.whyThis', { defaultValue: 'Vì sao?' })}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onApply(nudge.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.useful')}
          style={{ paddingHorizontal: spacing.md, paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
        >
          <Text variant="caption" style={{ color: colors.status.success, fontWeight: '700' }}>
            {t('common.useful')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDismiss(nudge.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          style={{ paddingHorizontal: spacing.md, paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
        >
          <Text variant="caption" style={{ color: colors.text.muted, fontWeight: '700' }}>
            {t('common.dismiss')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MoodSleepCard({
  summary,
}: {
  summary: {
    lastSleepMinutes: number | null;
    lastSleepQuality: string | null;
    lastMood: string | null;
    lastEnergy: string | null;
  };
}) {
  const { t } = useTranslation();
  const hasData = summary.lastSleepMinutes != null || summary.lastMood;
  return (
    <Card>
      <Text variant="bodyEm">{t('home.cards.moodSleepTitle')}</Text>
      {!hasData ? (
        <Text variant="caption">{t('home.cards.moodSleepEmpty')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
          {summary.lastSleepMinutes != null ? (
            <View>
              <Icon name="moon-outline" size={16} color={colors.text.muted} />
              <Text variant="bodyEm" style={{ marginTop: 2 }}>
                {`${Math.floor(summary.lastSleepMinutes / 60)}h${String(
                  summary.lastSleepMinutes % 60,
                ).padStart(2, '0')}`}
              </Text>
              {summary.lastSleepQuality ? (
                <Text variant="caption">{summary.lastSleepQuality}</Text>
              ) : null}
            </View>
          ) : null}
          {summary.lastMood ? (
            <View>
              <Icon name="happy-outline" size={16} color={colors.text.muted} />
              <Text variant="bodyEm" style={{ marginTop: 2 }}>{summary.lastMood}</Text>
              {summary.lastEnergy ? (
                <Text variant="caption">{summary.lastEnergy}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}
