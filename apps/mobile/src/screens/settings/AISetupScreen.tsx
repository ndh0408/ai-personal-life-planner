import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import {
  Screen,
  Card,
  Button,
  Input,
  IconButton,
  PrivacyNoticeCard,
} from '../../components/ui';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Consumer-grade "paste your OpenAI key" screen — the simplest path
 * to enabling AI for the user.
 *
 * Hits `POST /user-ai-providers/openai-simple` which:
 *   1. Encrypts the key,
 *   2. Inserts a row with sensible defaults (provider=OPENAI,
 *      baseUrl=server default, model=server default),
 *   3. Tests it upstream,
 *   4. Rolls back on failure (so retries don't accumulate orphan rows).
 *
 * Power users still have the full form via "Advanced" (other providers)
 * on `AiProviderSettingsScreen`.
 */
export function AISetupScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const save = useMutation({
    mutationFn: () => userAiProvidersApi.createOpenAiSimple({ apiKey: apiKey.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiPreference });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (res.test.ok) {
        Alert.alert(t('settings.aiSetup.successTitle'), t('settings.aiSetup.successBody'), [
          { text: t('common.ok'), onPress: () => nav.goBack() },
        ]);
      } else {
        // Backend already rolled back the row. Surface the most specific
        // error code we have — falls back to `AI_PROVIDER_TEST_FAILED`.
        const code = res.test.errorCode ?? 'AI_PROVIDER_TEST_FAILED';
        Alert.alert(
          t(`errors.${code}`, { defaultValue: t('errors.AI_PROVIDER_TEST_FAILED') }),
          t('settings.aiSetup.rolledBack'),
        );
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const canSubmit = apiKey.trim().length >= 8 && !save.isPending;

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
          {t('settings.aiSetup.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
          {t('settings.aiSetup.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('settings.aiSetup.fieldLabel')}
                placeholder={t('settings.aiSetup.fieldPlaceholder')}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
                textContentType="password"
              />
            </View>
            <IconButton
              icon={showKey ? '🙈' : '👁'}
              accessibilityLabel={
                showKey ? t('settings.aiSetup.hideKey') : t('settings.aiSetup.showKey')
              }
              onPress={() => setShowKey((v) => !v)}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
            <TouchableOpacity onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('settings.aiSetup.linkWhereGet')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://platform.openai.com/docs/api-reference/authentication')}>
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('settings.aiSetup.linkWhatIs')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <PrivacyNoticeCard
          title={t('settings.aiSetup.encryptedNoticeTitle')}
          description={t('settings.aiSetup.encryptedNotice')}
          tone="info"
        />

        <Button
          title={save.isPending ? t('settings.aiSetup.testing') : t('settings.aiSetup.testAndSave')}
          onPress={() => save.mutate()}
          disabled={!canSubmit}
          loading={save.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.xl }}
        />

        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={{
            paddingVertical: spacing.md,
            alignItems: 'center',
            marginTop: spacing.sm,
            borderRadius: radius.md,
          }}
        >
          <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>
            {t('settings.aiSetup.skipForNow')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
