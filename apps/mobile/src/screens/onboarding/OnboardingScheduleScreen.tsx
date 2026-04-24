import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, Input, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboarding.store';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeHhmm(s: string): string {
  const cleaned = s.replace(/[^\d:]/g, '');
  if (cleaned.length === 4 && !cleaned.includes(':')) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }
  return cleaned;
}

export function OnboardingScheduleScreen({ navigation }: OnboardingScreenProps<'Schedule'>) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);

  const valid = [draft.workStartTime, draft.workEndTime, draft.usualWakeTime, draft.usualSleepTime].every((v) => HHMM.test(v));

  return (
    <Screen scroll>
      <StepProgress total={5} current={4} />
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('onboarding.schedule.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('onboarding.schedule.subtitle')}
      </Text>

      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.schedule.workStart')}
              placeholder="09:00"
              value={draft.workStartTime}
              onChangeText={(v) => patch({ workStartTime: normalizeHhmm(v) })}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.schedule.workEnd')}
              placeholder="18:00"
              value={draft.workEndTime}
              onChangeText={(v) => patch({ workEndTime: normalizeHhmm(v) })}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.schedule.wakeTime')}
              placeholder="06:30"
              value={draft.usualWakeTime}
              onChangeText={(v) => patch({ usualWakeTime: normalizeHhmm(v) })}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.schedule.sleepTime')}
              placeholder="23:00"
              value={draft.usualSleepTime}
              onChangeText={(v) => patch({ usualSleepTime: normalizeHhmm(v) })}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <Input
          label={t('onboarding.schedule.timezone')}
          placeholder="Asia/Ho_Chi_Minh"
          value={draft.timezone}
          onChangeText={(timezone) => patch({ timezone })}
        />
        <Text style={[typography.small, { color: colors.textMuted }]}>
          {t('onboarding.schedule.hint')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button title={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Button
          title={t('common.next')}
          onPress={() => navigation.navigate('Finance')}
          disabled={!valid}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}
