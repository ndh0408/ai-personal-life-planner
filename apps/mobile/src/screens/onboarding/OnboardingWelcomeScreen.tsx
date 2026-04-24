import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Button, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { setLocale, SUPPORTED_LOCALES, getActiveLocale } from '../../i18n';
import { useOnboardingStore } from '../../store/onboarding.store';

export function OnboardingWelcomeScreen({ navigation }: OnboardingScreenProps<'Welcome'>) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const patch = useOnboardingStore((s) => s.patch);
  const [selected, setSelected] = useState<'vi' | 'en'>(getActiveLocale() as 'vi' | 'en');

  async function pickLocale(locale: 'vi' | 'en') {
    setSelected(locale);
    await setLocale(locale);
    patch({ locale });
  }

  return (
    <Screen>
      <StepProgress total={5} current={1} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.display, { color: colors.text }]}>
          {t('onboarding.welcome.headline1')}
        </Text>
        <Text style={[typography.display, { color: colors.primary, marginBottom: spacing.lg }]}>
          {t('onboarding.welcome.headline2')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>
          {t('onboarding.welcome.body')}
        </Text>

        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {t('onboarding.welcome.pickLanguage')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {SUPPORTED_LOCALES.map((code) => {
            const active = selected === code;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => pickLocale(code as 'vi' | 'en')}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.surfaceMuted : colors.surface,
                }}
              >
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t(`settings.language.${code}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Button
        title={t('onboarding.welcome.cta')}
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('Profile')}
      />
    </Screen>
  );
}
