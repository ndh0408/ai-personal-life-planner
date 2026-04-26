import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../design/Screen';
import { Button } from '../design/Button';
import { Input } from '../design/Input';
import { Body, Display, Kicker, Link } from '../design/Text';
import { space } from '../design/theme';
import { authApi } from '../api/auth';
import { aiKeyApi } from '../api/aiKey';
import { apiClient } from '../api/client';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { readableError } from '../lib/errors';

interface Props {
  onGoToRegister: () => void;
}

export function LoginScreen({ onGoToRegister }: Props) {
  const { t } = useI18n();
  const { setUser, setHasAiKey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      apiClient.setTokens(res.tokens);
      setUser(res.user);
      // Hydrate ai-key status — auth store will route accordingly.
      try {
        const status = await aiKeyApi.status();
        setHasAiKey(status.enabled);
      } catch {
        setHasAiKey(false);
      }
    } catch (e) {
      setError(readableError(e, t, 'auth'));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.length > 3 && password.length >= 1 && !busy;

  return (
    <Screen>
      <Kicker>LifeOS AI</Kicker>
      <Display style={{ marginTop: space.md }}>{t('auth.loginTitle')}</Display>
      <Body style={{ marginTop: space.sm, marginBottom: space.xl }}>
        {t('auth.loginSubtitle')}
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
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          secret
          error={error}
        />
        <Button label={t('auth.loginCta')} onPress={submit} loading={busy} disabled={!canSubmit} />
      </View>

      <View style={{ marginTop: space['2xl'], flexDirection: 'row', justifyContent: 'center', gap: space.xs }}>
        <Body>{t('auth.noAccount')}</Body>
        <Link onPress={onGoToRegister}>{t('auth.signUpLink')}</Link>
      </View>
    </Screen>
  );
}
