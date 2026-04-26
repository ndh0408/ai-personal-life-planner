import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Screen } from '../design/Screen';
import { Button } from '../design/Button';
import { Input } from '../design/Input';
import { Body, BodyStrong, Caption, Kicker, Title } from '../design/Text';
import { Card } from '../design/Card';
import { StatusDot } from '../design/StatusDot';
import { space } from '../design/theme';
import { aiKeyApi, type AiKeyStatus } from '../api/aiKey';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { readableError } from '../lib/errors';

interface Props {
  onBack: () => void;
}

export function AISettingsScreen({ onBack }: Props) {
  const { t, locale } = useI18n();
  const { setHasAiKey } = useAuth();

  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'test' | 'replace' | 'delete' | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await aiKeyApi.status();
      setStatus(next);
      setHasAiKey(next.enabled);
    } finally {
      setLoading(false);
    }
  }, [setHasAiKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleTest = async () => {
    setBusy('test');
    try {
      const r = await aiKeyApi.test();
      Alert.alert(
        r.status === 'SUCCESS' ? t('aiSettings.testStatusSuccess') : t('aiSettings.testStatusFailed'),
        r.message ?? r.maskedApiKey,
      );
      await refresh();
    } catch (e) {
      Alert.alert(t('aiSetup.failedTitle'), readableError(e, t, 'aiSetup'));
    } finally {
      setBusy(null);
    }
  };

  const handleReplace = async () => {
    setBusy('replace');
    setReplaceError(null);
    try {
      await aiKeyApi.setupOpenAi(newKey.trim());
      setNewKey('');
      setReplaceMode(false);
      await refresh();
    } catch (e) {
      setReplaceError(readableError(e, t, 'aiSetup'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('aiSettings.deleteConfirmTitle'),
      t('aiSettings.deleteConfirmBody'),
      [
        { text: t('aiSettings.deleteConfirmNo'), style: 'cancel' },
        {
          text: t('aiSettings.deleteConfirmYes'),
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await aiKeyApi.remove();
              setHasAiKey(false);
              await refresh();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const formattedTestTime =
    status?.lastTestedAt
      ? new Date(status.lastTestedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')
      : t('aiSettings.testNever');

  return (
    <Screen>
      <Kicker>{t('aiSettings.title')}</Kicker>
      <Title style={{ marginTop: space.md, marginBottom: space.xl }}>
        {status?.enabled ? t('aiSettings.statusEnabled') : t('aiSettings.statusDisabled')}
      </Title>

      {loading || !status ? (
        <Body>{t('common.loading')}</Body>
      ) : (
        <View style={{ gap: space.lg }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <StatusDot
                tone={
                  !status.enabled
                    ? 'muted'
                    : status.lastTestStatus === 'SUCCESS'
                    ? 'success'
                    : status.lastTestStatus === 'FAILED'
                    ? 'danger'
                    : 'warning'
                }
              />
              <BodyStrong>{status.maskedApiKey ?? '—'}</BodyStrong>
            </View>
            <Caption>
              {t('aiSettings.lastTest')}: {formattedTestTime}
            </Caption>
            <Caption>
              {status.lastTestStatus === 'SUCCESS'
                ? t('aiSettings.testStatusSuccess')
                : status.lastTestStatus === 'FAILED'
                ? t('aiSettings.testStatusFailed')
                : t('aiSettings.testNever')}
            </Caption>
          </Card>

          {replaceMode ? (
            <View style={{ gap: space.md }}>
              <Input
                label={t('aiSetup.keyLabel')}
                placeholder={t('aiSetup.keyPlaceholder')}
                value={newKey}
                onChangeText={setNewKey}
                secret
                error={replaceError}
              />
              <Button
                label={t('aiSetup.saveCta')}
                onPress={handleReplace}
                loading={busy === 'replace'}
                disabled={busy !== null || newKey.trim().length < 20}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  setNewKey('');
                  setReplaceMode(false);
                  setReplaceError(null);
                }}
              />
            </View>
          ) : (
            <View style={{ gap: space.md }}>
              {status.enabled ? (
                <>
                  <Button
                    label={t('aiSettings.testCta')}
                    variant="secondary"
                    onPress={handleTest}
                    loading={busy === 'test'}
                    disabled={busy !== null}
                  />
                  <Button
                    label={t('aiSettings.replaceCta')}
                    variant="secondary"
                    onPress={() => setReplaceMode(true)}
                    disabled={busy !== null}
                  />
                  <Button
                    label={t('aiSettings.deleteCta')}
                    variant="danger"
                    onPress={handleDelete}
                    loading={busy === 'delete'}
                    disabled={busy !== null}
                  />
                </>
              ) : (
                <Button
                  label={t('aiSetup.saveCta')}
                  onPress={() => setReplaceMode(true)}
                  disabled={busy !== null}
                />
              )}
            </View>
          )}

          <Button label={t('common.back')} variant="ghost" onPress={onBack} />
        </View>
      )}
    </Screen>
  );
}
