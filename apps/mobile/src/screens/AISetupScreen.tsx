import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../design/Screen';
import { Button } from '../design/Button';
import { Input } from '../design/Input';
import { Body, Display, Kicker, Link, Title } from '../design/Text';
import { Card } from '../design/Card';
import { palette, space } from '../design/theme';
import { aiKeyApi } from '../api/aiKey';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { readableError } from '../lib/errors';

export function AISetupScreen() {
  const { t } = useI18n();
  const { setHasAiKey, finishAiSetup } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const status = await aiKeyApi.setupOpenAi(apiKey.trim());
      // Drop the raw key from React state immediately; never keep it longer than the network call.
      setApiKey('');
      if (status.lastTestStatus === 'SUCCESS') {
        setHasAiKey(true);
      } else {
        // Saved, but the test failed. Surface the situation; user can retry on AISettings later.
        Alert.alert(t('aiSetup.failedTitle'), t('aiSetup.errors.AI_KEY_TEST_FAILED'));
        setHasAiKey(true); // still navigate forward so they aren't trapped
      }
    } catch (e) {
      setError(readableError(e, t, 'aiSetup'));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    setApiKey('');
    finishAiSetup();
  };

  const canSubmit = apiKey.trim().length >= 20 && apiKey.trim().startsWith('sk-') && !busy;

  return (
    <Screen>
      <Kicker>{t('aiSetup.kicker')}</Kicker>
      <Display style={{ marginTop: space.md }}>{t('aiSetup.title')}</Display>
      <Body style={{ marginTop: space.sm, marginBottom: space.xl }}>
        {t('aiSetup.subtitle')}
      </Body>

      <View style={{ gap: space.lg }}>
        <Input
          label={t('aiSetup.keyLabel')}
          placeholder={t('aiSetup.keyPlaceholder')}
          value={apiKey}
          onChangeText={setApiKey}
          secret
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
        <Button
          label={busy ? t('aiSetup.testing') : t('aiSetup.saveCta')}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
        <Button label={t('aiSetup.skipCta')} variant="ghost" onPress={skip} />
        <View style={styles.helpRow}>
          <Link onPress={() => setHelpOpen(true)}>{t('aiSetup.noKeyHint')}</Link>
        </View>
      </View>

      <Modal
        visible={helpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
      >
        <Pressable style={styles.modalScrim} onPress={() => setHelpOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card style={styles.modalCard}>
              <Title>{t('aiSetup.noKeyModalTitle')}</Title>
              <Body>{t('aiSetup.noKeyModalBody')}</Body>
              <Button label={t('common.ok')} onPress={() => setHelpOpen(false)} />
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  helpRow: { alignItems: 'center', marginTop: space.sm },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  modalCard: {
    backgroundColor: palette.surfaceAlt,
  },
});
