import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, Input, Chip, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboarding.store';

const GENDERS = ['male', 'female', 'other'] as const;

export function OnboardingProfileScreen({ navigation }: OnboardingScreenProps<'Profile'>) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const draft = useOnboardingStore((s) => s.draft);
  const patch = useOnboardingStore((s) => s.patch);

  const canNext =
    draft.fullName.trim().length > 0 &&
    draft.age.trim().length > 0 &&
    Number(draft.age) > 0 &&
    Number(draft.age) <= 120;

  return (
    <Screen scroll>
      <StepProgress total={5} current={2} />
      <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.xs }]}>
        {t('onboarding.profile.title')}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('onboarding.profile.subtitle')}
      </Text>

      <View style={{ gap: spacing.md }}>
        <Input
          label={t('onboarding.profile.fullName')}
          placeholder={t('onboarding.profile.fullNamePlaceholder')}
          value={draft.fullName}
          onChangeText={(fullName) => patch({ fullName })}
          autoCapitalize="words"
        />
        <Input
          label={t('onboarding.profile.age')}
          placeholder="28"
          value={draft.age}
          onChangeText={(age) => patch({ age: age.replace(/[^\d]/g, '') })}
          keyboardType="number-pad"
        />
        <View>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            {t('onboarding.profile.gender')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {GENDERS.map((g) => (
              <Chip
                key={g}
                label={t(`onboarding.profile.genders.${g}`)}
                selected={draft.gender === g}
                onPress={() => patch({ gender: draft.gender === g ? '' : g })}
              />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.profile.heightCm')}
              placeholder="172"
              value={draft.heightCm}
              onChangeText={(heightCm) => patch({ heightCm: heightCm.replace(/[^\d.]/g, '') })}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t('onboarding.profile.weightKg')}
              placeholder="68"
              value={draft.weightKg}
              onChangeText={(weightKg) => patch({ weightKg: weightKg.replace(/[^\d.]/g, '') })}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Input
          label={t('onboarding.profile.occupation')}
          placeholder={t('onboarding.profile.occupationPlaceholder')}
          value={draft.occupation}
          onChangeText={(occupation) => patch({ occupation })}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Button title={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Button
          title={t('common.next')}
          onPress={() => navigation.navigate('Goal')}
          disabled={!canNext}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}
