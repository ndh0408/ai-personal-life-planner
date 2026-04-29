import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Card,
  InsightCard,
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { useCaptureConfirm, useCaptureParse } from '../../hooks/useCapture';
import { useFeedInvalidator } from '../../hooks/useFeed';
import { useUpdateRecommendationStatus } from '../../hooks/useRecommendations';
import { QuickCaptureBar } from '../../components/quick-capture/QuickCaptureBar';
import { CapturePreviewSheet } from '../../components/quick-capture/CapturePreviewSheet';
import { HomeHero } from '../../components/home/HomeHero';
import { QuickActionsRow } from '../../components/home/QuickActionsRow';
import type { CaptureParseResponse } from '../../services/api/capture.service';
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

  const summary = useDashboardSummary();
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
      onSuccess: () => {
        setSheetOpen(false);
        setParsed(null);
        toast.show(t('capture.saved'), 'success');
        invalidateFeed();
        void summary.refetch();
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

          <HomeHero
            aiEnabled={aiEnabled}
            userName={greetingName}
            onAddKey={() => navigation.navigate('AISettings')}
            onCapture={() => navigation.navigate('SmartEntry')}
            onPlan={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Today' })}
          />

          <QuickActionsRow
            actions={[
              { key: 'capture', onPress: () => navigation.navigate('SmartEntry') },
              { key: 'expense', onPress: () => navigation.navigate('SmartEntry') },
              { key: 'task', onPress: () => navigation.navigate('SmartEntry') },
              { key: 'checkin', onPress: () => navigation.navigate('SleepMoodCheckin') },
              {
                key: 'askAi',
                onPress: () =>
                  navigation.getParent()?.navigate('MainTabs', { screen: 'Assistant' }),
                disabled: !aiEnabled,
              },
            ]}
          />

          {summary.isLoading && !summary.data ? (
            <LoadingState />
          ) : summary.data ? (
            <View style={{ gap: spacing.md }}>
              <TodayPlanCard
                summary={summary.data.todayPlan}
                onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Today' })}
              />
              <MoneyCard
                summary={summary.data.money}
                onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Money' })}
              />
              <NextTaskCard task={summary.data.nextTask} />
              <NudgeCard
                nudge={summary.data.topRecommendation}
                onDismiss={(id) => updateRec.mutate({ id, status: 'DISMISSED' })}
              />
              <MoodSleepCard summary={summary.data.moodSleep} />
            </View>
          ) : null}
        </ScrollView>
      </AppScreen>

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
            {aiEnabled ? '✨ AI' : t('home.heroNoAi.cta')}
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
            ✨ AI
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

function NudgeCard({
  nudge,
  onDismiss,
}: {
  nudge:
    | { id: string; type: string; title: string; content: string; priority: string }
    | null;
  onDismiss: (id: string) => void;
}) {
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
      <Pressable
        onPress={() => onDismiss(nudge.id)}
        hitSlop={6}
        style={{ alignSelf: 'flex-end', marginTop: 6, padding: 4 }}
      >
        <Text variant="caption" style={{ color: colors.text.muted }}>
          ✕
        </Text>
      </Pressable>
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
              <Text variant="caption">💤</Text>
              <Text variant="bodyEm">
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
              <Text variant="caption">🎯</Text>
              <Text variant="bodyEm">{summary.lastMood}</Text>
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
