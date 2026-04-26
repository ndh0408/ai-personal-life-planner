import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppScreen,
  Card,
  EmptyState,
  InsightCard,
  QuickActionButton,
  StatCard,
  Text,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useHealth } from '../../hooks/useHealth';

export function HomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: health } = useHealth();

  const greetingName =
    user?.displayName?.trim() || user?.email.split('@')[0] || '';

  return (
    <AppScreen>
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
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor:
                health?.status === 'ok'
                  ? '#7FA66B'
                  : health?.status === 'unreachable'
                  ? '#C9624A'
                  : '#D6A24E',
            }}
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

      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <QuickActionButton
          label={t('home.quickCapturePlaceholder')}
          glyph="✎"
          onPress={() => {
            /* round 2 wires Quick Capture flow */
          }}
        />
      </View>

      <Text variant="kicker" style={{ marginBottom: spacing.md }}>
        {t('home.insights.title')}
      </Text>
      <EmptyState title={t('home.insights.empty')} />
    </AppScreen>
  );
}
