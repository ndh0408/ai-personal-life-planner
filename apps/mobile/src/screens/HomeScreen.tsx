import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../design/Screen';
import { Button } from '../design/Button';
import { Body, BodyStrong, Caption, Display, Kicker } from '../design/Text';
import { Card } from '../design/Card';
import { StatusDot } from '../design/StatusDot';
import { space } from '../design/theme';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { probeHealth, type HealthResult } from '../api/health';
import { apiClient } from '../api/client';

interface Props {
  onOpenAISettings: () => void;
}

export function HomeScreen({ onOpenAISettings }: Props) {
  const { t } = useI18n();
  const { state, signOut } = useAuth();
  const [health, setHealth] = useState<HealthResult | null>(null);

  useEffect(() => {
    void probeHealth().then(setHealth);
  }, []);

  const greetingName = state.user?.displayName?.trim() || state.user?.email.split('@')[0] || '';

  const tone =
    health?.status === 'ok' ? 'success' : health?.status === 'unreachable' ? 'danger' : 'warning';
  const apiLabel =
    health?.status === 'ok'
      ? t('home.apiHealthy')
      : health?.status === 'unreachable'
      ? t('home.apiUnreachable')
      : t('home.apiDegraded');

  const handleLogout = async () => {
    const refresh = apiClient.getTokens()?.refreshToken;
    await signOut(refresh);
  };

  return (
    <Screen>
      <Kicker>{t('home.kicker')}</Kicker>
      <Display style={{ marginTop: space.md }}>{t('home.greeting', { name: greetingName })}</Display>
      <Body style={{ marginTop: space.sm, marginBottom: space.xl }}>{t('home.ready')}</Body>

      <View style={{ gap: space.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <StatusDot tone={tone} />
            <BodyStrong>{apiLabel}</BodyStrong>
          </View>
          {health ? <Caption>{`${health.baseUrl} · ${health.latencyMs}ms`}</Caption> : null}
        </Card>

        <Button label={t('aiSettings.title')} variant="secondary" onPress={onOpenAISettings} />
        <Button label={t('auth.logoutCta')} variant="ghost" onPress={handleLogout} />
      </View>
    </Screen>
  );
}
