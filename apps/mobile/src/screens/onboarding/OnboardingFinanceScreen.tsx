import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, Input, Chip, StepProgress, Loading } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboarding.store';
import { useAuthStore } from '../../store/auth.store';
import { profileApi } from '../../services/api/profile.api';
import { walletsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { setLocale, type SupportedLocale } from '../../i18n';

const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY'] as const;

function toHhmm(v: string): string | undefined {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined;
}

export function OnboardingFinanceScreen({ navigation }: OnboardingScreenProps<'Finance'>) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);
  const resetDraft = useOnboardingStore((s) => s.reset);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const [submitting, setSubmitting] = useState(false);

  async function finish() {
    setSubmitting(true);
    try {
      const monthlySalaryNum = draft.monthlySalary ? Number(draft.monthlySalary) : undefined;
      const salaryDayNum = draft.salaryDay ? Number(draft.salaryDay) : undefined;

      const profile = await profileApi.update({
        fullName: draft.fullName,
        age: draft.age ? Number(draft.age) : undefined,
        gender: draft.gender || undefined,
        heightCm: draft.heightCm ? Number(draft.heightCm) : undefined,
        weightKg: draft.weightKg ? Number(draft.weightKg) : undefined,
        occupation: draft.occupation || undefined,
        mainGoal: (draft.mainGoal || undefined) as never,
        activityLevel: (draft.activityLevel || undefined) as never,
        dietaryPreference: draft.dietaryPreference || undefined,
        healthNotes: draft.healthNotes || undefined,
        workStartTime: toHhmm(draft.workStartTime),
        workEndTime: toHhmm(draft.workEndTime),
        usualWakeTime: toHhmm(draft.usualWakeTime),
        usualSleepTime: toHhmm(draft.usualSleepTime),
        timezone: draft.timezone,
        locale: draft.locale,
        monthlySalary: monthlySalaryNum,
        salaryDay: salaryDayNum,
        currency: draft.currency,
      } as never);

      // Default wallets — create in parallel, swallow individual failures so
      // a duplicate-name from a prior retry doesn't block the user.
      await Promise.all([
        draft.createCashWallet
          ? walletsApi
              .create({ name: 'Cash', type: 'CASH', currency: draft.currency })
              .catch(() => null)
          : Promise.resolve(null),
        draft.createBankWallet
          ? walletsApi
              .create({ name: 'Bank', type: 'BANK', currency: draft.currency })
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      await setLocale(draft.locale as SupportedLocale).catch(() => undefined);

      resetDraft();
      if (profile) completeOnboarding(profile as never);
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) return <Loading />;

  const validSalaryDay =
    draft.salaryDay === '' || (Number(draft.salaryDay) >= 1 && Number(draft.salaryDay) <= 31);
  const validSalary =
    draft.monthlySalary === '' || Number(draft.monthlySalary) > 0;
  const canFinish = validSalary && validSalaryDay;

  return (
    <Screen scroll>
      <StepProgress total={5} current={5} />
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('onboarding.finance.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('onboarding.finance.subtitle')}
      </Text>

      <View style={{ gap: spacing.md }}>
        <Input
          label={t('onboarding.finance.monthlySalary')}
          placeholder="25000000"
          value={draft.monthlySalary}
          onChangeText={(v) => patch({ monthlySalary: v.replace(/[^\d]/g, '') })}
          keyboardType="number-pad"
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.finance.salaryDay')}
              placeholder="5"
              value={draft.salaryDay}
              onChangeText={(v) => patch({ salaryDay: v.replace(/[^\d]/g, '').slice(0, 2) })}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('onboarding.finance.currency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {CURRENCIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={draft.currency === c}
                  onPress={() => patch({ currency: c })}
                />
              ))}
            </View>
          </View>
        </View>

        <Text style={[typography.bodyStrong, { color: colors.text, marginTop: spacing.md }]}>
          {t('onboarding.finance.defaultWallets')}
        </Text>
        <ToggleRow
          label={t('onboarding.finance.cashWallet')}
          value={draft.createCashWallet}
          onChange={(v) => patch({ createCashWallet: v })}
        />
        <ToggleRow
          label={t('onboarding.finance.bankWallet')}
          value={draft.createBankWallet}
          onChange={(v) => patch({ createBankWallet: v })}
        />
        <ToggleRow
          label={t('onboarding.finance.wantsMonthlyBudget')}
          description={t('onboarding.finance.wantsMonthlyBudgetHint')}
          value={draft.wantsMonthlyBudget}
          onChange={(v) => patch({ wantsMonthlyBudget: v })}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button title={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Button
          title={t('onboarding.finance.finish')}
          onPress={finish}
          disabled={!canFinish}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
