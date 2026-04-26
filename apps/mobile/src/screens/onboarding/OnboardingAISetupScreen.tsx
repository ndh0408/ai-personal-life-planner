import React, { useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme, useResponsive } from '../../theme';
import {
  Screen,
  Card,
  Button,
  Input,
  IconButton,
  PrivacyNoticeCard,
  StepProgress,
  Loading,
} from '../../components/ui';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { profileApi } from '../../services/api/profile.api';
import { walletsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import { setLocale, type SupportedLocale } from '../../i18n';
import { useOnboardingStore } from '../../store/onboarding.store';
import { useAuthStore } from '../../store/auth.store';
import type { OnboardingScreenProps } from '../../navigation/types';

/**
 * Round 21 — Step 3/3. AI key paste + onboarding finalisation.
 *
 * Wraps the same `POST /user-ai-providers/openai-simple` flow that the
 * standalone `AISetupScreen` uses, with the onboarding-specific
 * "complete profile + create default wallet + log in" finish path
 * after success or skip.
 */
function toHhmm(v: string): string | undefined {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined;
}

export function OnboardingAISetupScreen({
  navigation,
}: OnboardingScreenProps<'AISetupOnboarding'>) {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useTranslation();
  const { isTablet } = useResponsive();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();
  const draft = useOnboardingStore((s) => s.draft);
  const resetDraft = useOnboardingStore((s) => s.reset);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * Persist the user's profile + create the default Cash wallet, then
   * mark onboarding complete. Called from both the success path
   * (after AI key save) and the skip path.
   */
  async function finishOnboarding(): Promise<boolean> {
    setBusy(true);
    try {
      const profile = await profileApi.update({
        fullName: draft.fullName.trim(),
        mainGoal: (draft.mainGoal || undefined) as never,
        activityLevel: (draft.activityLevel || undefined) as never,
        workStartTime: toHhmm(draft.workStartTime),
        workEndTime: toHhmm(draft.workEndTime),
        usualWakeTime: toHhmm(draft.usualWakeTime),
        usualSleepTime: toHhmm(draft.usualSleepTime),
        timezone: draft.timezone,
        locale: draft.locale,
        currency: draft.currency,
      } as never);

      // Auto-create the Cash wallet so AddExpense / Quick Capture have a
      // sensible default. Bank wallet stays opt-in (user creates from
      // Finance → Wallets later).
      if (draft.createCashWallet) {
        await walletsApi
          .create({ name: 'Cash', type: 'CASH', currency: draft.currency })
          .catch(() => null);
      }

      await setLocale(draft.locale as SupportedLocale).catch(() => undefined);

      resetDraft();
      if (profile) completeOnboarding(profile as never);
      return true;
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveAi = useMutation({
    mutationFn: () => userAiProvidersApi.createOpenAiSimple({ apiKey: apiKey.trim() }),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiProviders });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.aiPreference });
      if (res.test.ok) {
        Alert.alert(t('settings.aiSetup.successTitle'), t('settings.aiSetup.successBody'));
        await finishOnboarding();
      } else {
        const code = res.test.errorCode ?? 'AI_PROVIDER_TEST_FAILED';
        Alert.alert(
          t(`errors.${code}`, { defaultValue: t('errors.AI_PROVIDER_TEST_FAILED') }),
          t('settings.aiSetup.rolledBack'),
        );
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const canSubmit = apiKey.trim().length >= 8 && !saveAi.isPending && !busy;

  if (busy) return <Loading />;

  return (
    <Screen scroll>
      <StepProgress total={3} current={3} />
      <View
        style={{
          maxWidth: isTablet ? 640 : undefined,
          alignSelf: isTablet ? 'center' : 'stretch',
          width: '100%',
        }}
      >
        <Text style={[typography.eyebrow, { color: colors.primary, marginBottom: spacing.sm }]}>
          {t('onboarding.basics.kickerStep3', { defaultValue: 'STEP 03 · ENABLE AI' })}
        </Text>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
          {t('settings.aiSetup.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
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

          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
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
          title={saveAi.isPending ? t('settings.aiSetup.testing') : t('settings.aiSetup.testAndSave')}
          onPress={() => saveAi.mutate()}
          disabled={!canSubmit}
          loading={saveAi.isPending}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.xl }}
        />

        <TouchableOpacity
          onPress={() => finishOnboarding()}
          style={{
            paddingVertical: spacing.md,
            alignItems: 'center',
            marginTop: spacing.sm,
            borderRadius: radius.md,
          }}
          accessibilityRole="button"
        >
          <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>
            {t('settings.aiSetup.skipForNow')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ alignItems: 'center', marginTop: spacing.sm }}
          accessibilityRole="button"
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
