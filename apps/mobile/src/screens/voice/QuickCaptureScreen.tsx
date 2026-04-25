import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Input } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Quick capture entry point. Voice transcription is a stub today (server
 * STT not wired) — the screen falls back to a text field. Mic activation,
 * when wired in v1.3, MUST be a press-and-hold pattern with a clear
 * "Recording…" indicator and Stop button. No always-on mic, no hotword.
 */
export function QuickCaptureScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const [text, setText] = useState('');

  const parseMut = useMutation({
    mutationFn: () =>
      voiceCompanionApi.parseQuickCapture({
        transcript: text.trim(),
        source: 'TEXT_FALLBACK',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pendingActions });
      setText('');
      nav.navigate('SuggestedActionsReview');
    },
    onError: (e) => Alert.alert(t('settings.quickCapture.errorTitle'), messageFor(e)),
  });

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.quickCapture.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.quickCapture.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.textMuted }}>
            {t('settings.quickCapture.transcribeStub')}
          </Text>
        </Card>

        <Input
          label={t('settings.quickCapture.placeholder')}
          value={text}
          onChangeText={setText}
          multiline
          autoCapitalize="sentences"
          style={{ minHeight: 120 }}
        />

        <Button
          title={t('settings.quickCapture.send')}
          onPress={() => parseMut.mutate()}
          loading={parseMut.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}
