import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge, Chip } from '../../components/ui';
import { widgetsApi } from '../../services/api/widgets.api';
import { useAuthStore } from '../../store/auth.store';
import { widgetSnapshotStore } from '../../services/widgets/snapshot-store';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type {
  UpdateWidgetPreferencesInput,
  WidgetPreferencesDto,
  WidgetPrivacyModeDto,
  WidgetSummaryDto,
} from '@planner/shared';

type ToggleKey = keyof Omit<
  WidgetPreferencesDto,
  'updatedAt' | 'privacyMode'
>;

const ROWS: Array<{ key: ToggleKey; section: 'main' | 'finance' }> = [
  { key: 'enabled', section: 'main' },
  { key: 'showTasks', section: 'main' },
  { key: 'showRecommendations', section: 'main' },
  { key: 'showHealthData', section: 'main' },
  { key: 'showFinance', section: 'finance' },
  { key: 'showFinanceAmounts', section: 'finance' },
];

const PRIVACY_MODES: WidgetPrivacyModeDto[] = ['FULL', 'HIDE_SENSITIVE', 'MINIMAL'];

export function WidgetSettingsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const prefsQ = useQuery({
    queryKey: QUERY_KEYS.widgetPreferences,
    queryFn: widgetsApi.getPreferences,
  });
  const summaryQ = useQuery({
    queryKey: QUERY_KEYS.widgetSummary,
    queryFn: widgetsApi.summary,
  });
  const [draft, setDraft] = useState<WidgetPreferencesDto | null>(null);
  useEffect(() => {
    if (prefsQ.data) setDraft(prefsQ.data);
  }, [prefsQ.data]);

  // Mirror every successful summary fetch into the on-disk widget snapshot.
  // Native widgets read the same key/file on the next refresh.
  useEffect(() => {
    if (summaryQ.data && userId) {
      void widgetSnapshotStore.write(userId, summaryQ.data);
    }
  }, [summaryQ.data, userId]);

  const mut = useMutation({
    mutationFn: (input: UpdateWidgetPreferencesInput) => widgetsApi.updatePreferences(input),
    onSuccess: (next) => {
      qc.setQueryData<WidgetPreferencesDto>(QUERY_KEYS.widgetPreferences, next);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.widgetSummary });
      setDraft(next);
      // When the user disables widgets entirely, wipe the cached snapshot
      // so the next native widget render shows nothing instead of stale.
      if (!next.enabled) {
        void widgetSnapshotStore.clear();
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (prefsQ.isLoading || !draft) return <Loading />;
  if (prefsQ.isError) {
    return <ErrorView message={messageFor(prefsQ.error)} onRetry={() => prefsQ.refetch()} />;
  }

  const onToggle = (key: ToggleKey, value: boolean) => {
    const payload: UpdateWidgetPreferencesInput = { [key]: value };
    // Cascade: turning off finance widget also clears finance-amount toggle.
    if (key === 'showFinance' && value === false) payload.showFinanceAmounts = false;
    setDraft({ ...draft, ...payload });
    mut.mutate(payload);
  };

  const onPrivacyMode = (mode: WidgetPrivacyModeDto) => {
    setDraft({ ...draft, privacyMode: mode });
    mut.mutate({ privacyMode: mode });
  };

  const sections: Array<['main' | 'finance', string]> = [
    ['main', t('settings.widgets.section.main')],
    ['finance', t('settings.widgets.section.finance')],
  ];

  const summary = summaryQ.data ?? null;

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.widgets.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.widgets.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {t('settings.widgets.promise')}
          </Text>
        </Card>

        {sections.map(([sec, label]) => (
          <View key={sec} style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                color: colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: '700',
                marginBottom: spacing.xs,
              }}
            >
              {label}
            </Text>
            <Card>
              {ROWS.filter((r) => r.section === sec).map((row, idx, arr) => {
                const disabled =
                  (row.key === 'showFinanceAmounts' && !draft.showFinance) ||
                  (sec !== 'main' && !draft.enabled);
                return (
                  <View
                    key={row.key}
                    style={{
                      paddingVertical: spacing.sm,
                      borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '600', flex: 1, paddingRight: 8 }}>
                        {t(`settings.widgets.toggles.${row.key}.label`)}
                      </Text>
                      <Switch
                        value={Boolean(draft[row.key])}
                        onValueChange={(v) => onToggle(row.key, v)}
                        disabled={disabled || mut.isPending}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                      {t(`settings.widgets.toggles.${row.key}.hint`)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </View>
        ))}

        {/* Privacy mode --------------------------------------------------- */}
        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.widgets.section.privacy')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.xs, flexWrap: 'wrap' }}>
          {PRIVACY_MODES.map((m) => (
            <Chip
              key={m}
              label={t(`settings.widgets.privacyMode.${m}`)}
              selected={draft.privacyMode === m}
              onPress={() => onPrivacyMode(m)}
            />
          ))}
        </View>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t(`settings.widgets.privacyMode.${draft.privacyMode}_hint`)}
          </Text>
        </Card>

        {/* Preview ------------------------------------------------------- */}
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.widgets.preview.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.widgets.preview.subtitle')}
        </Text>

        {summary ? (
          <PreviewCards summary={summary} />
        ) : summaryQ.isLoading ? (
          <Loading />
        ) : null}

        <Card style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.widgets.preview.lastUpdated')}:{' '}
            {summary ? new Date(summary.widgetUpdatedAt).toLocaleString() : '—'}
          </Text>
          <Button
            title={t('settings.widgets.preview.refresh')}
            variant="secondary"
            style={{ marginTop: spacing.sm }}
            loading={summaryQ.isFetching}
            onPress={() => summaryQ.refetch()}
          />
        </Card>

        <Text style={{ color: colors.textMuted, marginTop: spacing.lg }}>
          {t('settings.widgets.deepLinkNote')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function PreviewCards({ summary }: { summary: WidgetSummaryDto }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          {t('settings.widgets.preview.todayCard').toUpperCase()}
        </Text>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
          {summary.today.greeting}
        </Text>
        <Text style={{ color: colors.text, marginTop: 4 }}>
          {summary.today.pendingTaskCount} pending ·{' '}
          {summary.nextTask?.title ?? '—'}
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          {t('settings.widgets.preview.nudgeCard').toUpperCase()}
        </Text>
        {summary.topRecommendation ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '600', marginTop: 4 }}>
              {summary.topRecommendation.title}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={3}>
              {summary.topRecommendation.content}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {t('settings.widgets.preview.noNudge')}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          {t('settings.widgets.preview.financeCard').toUpperCase()}
        </Text>
        {summary.finance ? (
          summary.finance.amounts ? (
            <Text style={{ color: colors.text, marginTop: 4 }}>
              {summary.finance.amounts.totalIncome.toLocaleString()} −{' '}
              {summary.finance.amounts.totalExpense.toLocaleString()} ={' '}
              {summary.finance.amounts.remaining.toLocaleString()} {summary.finance.currency}
            </Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              <Badge tone="info">{t('settings.widgets.preview.amountsHidden')}</Badge>
              {summary.finance.budgetWarnings.map((b) => (
                <Text key={b.category} style={{ color: colors.textMuted, marginTop: 4 }}>
                  {t('settings.widgets.preview.budgetWarningRow', {
                    category: b.category,
                    percent: Math.round(b.usagePercent),
                  })}
                </Text>
              ))}
            </View>
          )
        ) : (
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {t('settings.widgets.preview.noFinance')}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
          {t('settings.widgets.preview.healthCard').toUpperCase()}
        </Text>
        {summary.health ? (
          <Text style={{ color: colors.text, marginTop: 4 }}>
            {t('settings.widgets.preview.healthSummary', {
              sleep: summary.health.sleepMinutes
                ? t('settings.widgets.preview.healthSleep', {
                    hours: (summary.health.sleepMinutes / 60).toFixed(1),
                  })
                : '—',
              mood: summary.health.mood ?? '—',
              energy: summary.health.energy ?? '—',
            })}
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {t('settings.widgets.preview.noHealth')}
          </Text>
        )}
      </Card>
    </View>
  );
}
