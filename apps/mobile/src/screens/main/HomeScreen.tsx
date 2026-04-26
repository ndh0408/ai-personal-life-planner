import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppScreen, Card, EmptyState, StatCard, Text, useToast } from '../../components/ui';
import { spacing, colors } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useHealth } from '../../hooks/useHealth';
import { useCaptureConfirm, useCaptureParse } from '../../hooks/useCapture';
import { QuickCaptureBar } from '../../components/quick-capture/QuickCaptureBar';
import { CapturePreviewSheet } from '../../components/quick-capture/CapturePreviewSheet';
import type { CaptureParseResponse } from '../../services/api/capture.service';

export function HomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: health } = useHealth();
  const toast = useToast();

  const [parsed, setParsed] = useState<CaptureParseResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const parse = useCaptureParse();
  const confirm = useCaptureConfirm();

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
          <StatCard label={t('home.stats.tasksToday')} value="0" hint="—" />
          <StatCard label={t('home.stats.spendToday')} value="0₫" hint="—" />
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

        <Text variant="kicker" style={{ marginBottom: spacing.md }}>
          {t('home.insights.title')}
        </Text>
        <EmptyState title={t('home.insights.empty')} />
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
