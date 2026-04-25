import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Loading, ErrorView, Badge } from '../../components/ui';
import { privacyApi, type DataUsageSummary } from '../../services/api/privacy.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';

const STORED_KEYS: Array<keyof DataUsageSummary['storedCounts']> = [
  'schedules',
  'tasks',
  'expenses',
  'incomes',
  'sleepLogs',
  'moodLogs',
  'healthMetrics',
  'aiMessages',
];

const AI_FLAG_KEYS: Array<{ key: keyof DataUsageSummary; label: string }> = [
  { key: 'aiSeesSchedule', label: 'aiSeesSchedule' },
  { key: 'aiSeesFinance', label: 'aiSeesFinance' },
  { key: 'aiSeesHealth', label: 'aiSeesHealth' },
  { key: 'aiSeesMeal', label: 'aiSeesMeal' },
];

export function DataUsageSummaryScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const q = useQuery({
    queryKey: QUERY_KEYS.dataUsageSummary,
    queryFn: privacyApi.dataUsageSummary,
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;

  const data = q.data;

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            marginBottom: spacing.md,
          }}
        >
          {t('settings.privacy.summary.title')}
        </Text>

        {/* AI visibility flags ------------------------------------------- */}
        <Card style={{ marginBottom: spacing.md }}>
          {AI_FLAG_KEYS.map(({ key, label }, idx) => (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === AI_FLAG_KEYS.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {t(`settings.privacy.summary.${label}`)}
              </Text>
              {data[key] ? (
                <Badge tone="success">{t('settings.privacy.summary.on')}</Badge>
              ) : (
                <Badge tone="danger">{t('settings.privacy.summary.off')}</Badge>
              )}
            </View>
          ))}
        </Card>

        {/* Stored counts ------------------------------------------------- */}
        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.privacy.summary.storedTitle')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          {STORED_KEYS.map((k, idx) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === STORED_KEYS.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {t(`settings.privacy.summary.stored.${k}`)}
              </Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {data.storedCounts[k]}
              </Text>
            </View>
          ))}
        </Card>

        {/* Recent consents ---------------------------------------------- */}
        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.privacy.summary.consentTitle')}
        </Text>
        <Card>
          {data.recentConsents.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              {t('settings.privacy.summary.noConsents')}
            </Text>
          ) : (
            data.recentConsents.map((c, idx) => (
              <View
                key={c.id}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: idx === data.recentConsents.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {c.consentType}
                  </Text>
                  {c.granted ? (
                    <Badge tone="success">{t('settings.privacy.summary.on')}</Badge>
                  ) : (
                    <Badge tone="danger">{t('settings.privacy.summary.off')}</Badge>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                  {new Date(c.grantedAt).toLocaleString()} · v{c.version}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
