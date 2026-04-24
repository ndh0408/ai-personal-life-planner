import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, Input, Chip, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboarding.store';

const MAIN_GOALS = [
  'LOSE_WEIGHT',
  'GAIN_WEIGHT',
  'SLEEP_EARLY',
  'PRODUCTIVE',
  'STUDY',
  'HEALTHY',
  'BALANCE',
  'FINANCIAL_STABILITY',
  'CAREER_GROWTH',
] as const;

const ACTIVITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function OnboardingGoalScreen({ navigation }: OnboardingScreenProps<'Goal'>) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);

  const canNext = !!draft.mainGoal && !!draft.activityLevel;

  return (
    <Screen scroll>
      <StepProgress total={5} current={3} />
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('onboarding.goal.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('onboarding.goal.subtitle')}
      </Text>

      <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
        {t('onboarding.goal.mainGoal')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
        {MAIN_GOALS.map((g) => (
          <Chip
            key={g}
            label={t(`onboarding.goal.mainGoals.${g}`)}
            selected={draft.mainGoal === g}
            onPress={() => patch({ mainGoal: draft.mainGoal === g ? '' : g })}
          />
        ))}
      </View>

      <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
        {t('onboarding.goal.activityLevel')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {ACTIVITY_LEVELS.map((a) => (
          <Chip
            key={a}
            label={t(`onboarding.goal.activities.${a}`)}
            selected={draft.activityLevel === a}
            onPress={() => patch({ activityLevel: draft.activityLevel === a ? '' : a })}
          />
        ))}
      </View>

      <Input
        label={t('onboarding.goal.dietaryPreference')}
        placeholder={t('onboarding.goal.dietaryPreferencePlaceholder')}
        value={draft.dietaryPreference}
        onChangeText={(dietaryPreference) => patch({ dietaryPreference })}
      />
      <View style={{ marginTop: spacing.md }}>
        <Input
          label={t('onboarding.goal.healthNotes')}
          placeholder={t('onboarding.goal.healthNotesPlaceholder')}
          value={draft.healthNotes}
          onChangeText={(healthNotes) => patch({ healthNotes })}
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button title={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Button
          title={t('common.next')}
          onPress={() => navigation.navigate('Schedule')}
          disabled={!canNext}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}
