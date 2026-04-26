import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../design/Screen';
import { Button } from '../design/Button';
import { Input } from '../design/Input';
import { Body, Display, Kicker, Link } from '../design/Text';
import { space } from '../design/theme';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { readableError } from '../lib/errors';

interface Props {
  onGoToLogin: () => void;
}

export function RegisterScreen({ onGoToLogin }: Props) {
  const { t } = useI18n();
  const { setUser, setHasAiKey } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      apiClient.setTokens(res.tokens);
      setUser(res.user);
      // Fresh account always lacks an AI key.
      setHasAiKey(false);
    } catch (e) {
      setError(readableError(e, t, 'auth'));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.length > 3 && password.length >= 8 && !busy;

  return (
    <Screen>
      <Kicker>LifeOS AI</Kicker>
      <Display style={{ marginTop: space.md }}>{t('auth.registerTitle')}</Display>
      <Body style={{ marginTop: space.sm, marginBottom: space.xl }}>
        {t('auth.registerSubtitle')}
      </Body>

      <View style={{ gap: space.lg }}>
        <Input
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label={t('auth.displayName')}
          placeholder={t('auth.displayNamePlaceholder')}
          autoCapitalize="words"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Input
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          secret
          error={error}
        />
        <Button
          label={t('auth.registerCta')}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
      </View>

      <View style={{ marginTop: space['2xl'], flexDirection: 'row', justifyContent: 'center', gap: space.xs }}>
        <Body>{t('auth.hasAccount')}</Body>
        <Link onPress={onGoToLogin}>{t('auth.signInLink')}</Link>
      </View>
    </Screen>
  );
}
