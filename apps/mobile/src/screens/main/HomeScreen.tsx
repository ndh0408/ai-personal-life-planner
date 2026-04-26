import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppScreen,
  Card,
  EmptyState,
  InsightCard,
  LoadingState,
  StatCard,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useHealth } from '../../hooks/useHealth';
import { useCaptureConfirm, useCaptureParse } from '../../hooks/useCapture';
import {
  useExpensesSummary,
  useFeedInvalidator,
  useLatestSleep,
  useTodayTasks,
} from '../../hooks/useFeed';
import {
  useRecommendations,
  useRefreshRecommendations,
  useUpdateRecommendationStatus,
} from '../../hooks/useRecommendations';
import { QuickCaptureBar } from '../../components/quick-capture/QuickCaptureBar';
import { CapturePreviewSheet } from '../../components/quick-capture/CapturePreviewSheet';
import type { CaptureParseResponse } from '../../services/api/capture.service';
import type { RecommendationPublic } from '../../services/api/recommendations.service';
import { formatMoney } from '../../utils/format';

export function HomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: health } = useHealth();
  const toast = useToast();

  const [parsed, setParsed] = useState<CaptureParseResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const parse = useCaptureParse();
  const confirm = useCaptureConfirm();
  const invalidateFeed = useFeedInvalidator();

  const tasks = useTodayTasks();
  const summary = useExpensesSummary();
  const sleep = useLatestSleep();
  const recs = useRecommendations();
  const refreshRecs = useRefreshRecommendations();
  const updateRec = useUpdateRecommendationStatus();

  const handleSend = (text: string) => {
    parse.mutate(text, {
      onSuccess: (data) => {
        setParsed(data);
        setSheetOpen(true);
      },
      onError: () => {
        toast.show(t('capture.errors.network'), 'danger');
      },
    });
  };

  const handleConfirm = (req: Parameters<typeof confirm.mutate>[0]) => {
    confirm.mutate(req, {
      onSuccess: () => {
        setSheetOpen(false);
        setParsed(null);
        toast.show(t('capture.saved'), 'success');
        invalidateFeed();
      },
      onError: () => {
        toast.show(t('capture.errors.network'), 'danger');
      },
    });
  };

  const greetingName = user?.displayName?.trim() || user?.email.split('@')[0] || '';

  const apiTone =
    health?.status === 'ok'
      ? colors.status.success
      : health?.status === 'unreachable'
      ? colors.status.danger
      : colors.status.warning;

  const tasksTodo = tasks.data ? tasks.data.total - tasks.data.doneCount : 0;
  const sleepHint =
    sleep.data != null
      ? `${Math.floor(sleep.data.durationMinutes / 60)}h${String(
          sleep.data.durationMinutes % 60,
        ).padStart(2, '0')}m`
      : '—';

  return (
    <>
      <AppScreen
        noBottomInset
        footer={<QuickCaptureBar busy={parse.isPending} onSend={handleSend} />}
      >
        <Text variant="kicker">{t('home.kicker')}</Text>
        <Text variant="display" style={{ marginTop: spacing.md }}>
          {t('home.greeting', { name: greetingName })}
        </Text>
        <Text style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>{t('home.ready')}</Text>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
          <StatCard
            label={t('home.stats.tasksToday')}
            value={String(tasksTodo)}
            hint={tasks.data ? `${tasks.data.doneCount}/${tasks.data.total}` : '—'}
          />
          <StatCard
            label={t('home.stats.spendToday')}
            value={formatMoney(summary.data?.todayTotal ?? 0)}
            hint={summary.data ? `tuần ${formatMoney(summary.data.weekTotal)}` : '—'}
          />
        </View>

        <Card style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: apiTone }}
            />
            <Text variant="bodyEm">
              {health?.status === 'ok'
                ? t('home.apiHealthy')
                : health?.status === 'unreachable'
                ? t('home.apiUnreachable')
                : t('home.apiDegraded')}
            </Text>
          </View>
          {health ? (
            <Text variant="caption">{`${health.baseUrl} · ${health.latencyMs}ms`}</Text>
          ) : null}
        </Card>

        <Card style={{ marginBottom: spacing.xl }}>
          <Text variant="kicker">{t('home.stats.sleepLastNight')}</Text>
          <Text variant="number">{sleepHint}</Text>
          {sleep.data?.quality ? <Text variant="caption">{sleep.data.quality}</Text> : null}
        </Card>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Text variant="kicker">{t('home.insights.title')}</Text>
          <Pressable
            onPress={() => refreshRecs.mutate()}
            disabled={refreshRecs.isPending}
            hitSlop={8}
          >
            <Text variant="caption" style={{ color: colors.accent.base, fontWeight: '700' }}>
              {refreshRecs.isPending ? '…' : '↻'}
            </Text>
          </Pressable>
        </View>

        {recs.isLoading ? (
          <LoadingState />
        ) : recs.data && recs.data.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {recs.data.map((r) => (
              <InsightRow
                key={r.id}
                rec={r}
                onDismiss={() => updateRec.mutate({ id: r.id, status: 'DISMISSED' })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title={t('home.insights.empty')} />
        )}
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

function InsightRow({
  rec,
  onDismiss,
}: {
  rec: RecommendationPublic;
  onDismiss: () => void;
}) {
  const tone =
    rec.priority === 'HIGH'
      ? rec.type === 'FINANCE' || rec.type === 'TASK'
        ? 'danger'
        : 'warning'
      : rec.priority === 'MEDIUM'
      ? 'info'
      : 'success';
  return (
    <View>
      <InsightCard title={rec.title} body={rec.content} tone={tone} />
      <Pressable
        onPress={onDismiss}
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
