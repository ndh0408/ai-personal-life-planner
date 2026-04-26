import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useResponsive } from '../../theme';
import { Screen, Button, StepProgress } from '../../components/ui';
import type { OnboardingScreenProps } from '../../navigation/types';
import { setLocale, SUPPORTED_LOCALES, getActiveLocale } from '../../i18n';
import { useOnboardingStore } from '../../store/onboarding.store';

/**
 * Step 1/3 — Welcome + language picker.
 *
 * Round 21: stripped down. The original screen had aspirational copy
 * + 5-step progress; the new flow advertises a 3-step path so users
 * don't feel they're being asked to fill out a form.
 */
export function OnboardingWelcomeScreen({ navigation }: OnboardingScreenProps<'Welcome'>) {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const { isTablet } = useResponsive();
  const patch = useOnboardingStore((s) => s.patch);
  const [selected, setSelected] = useState<'vi' | 'en'>(getActiveLocale() as 'vi' | 'en');

  async function pickLocale(locale: 'vi' | 'en') {
    setSelected(locale);
    await setLocale(locale);
    patch({ locale });
  }

  return (
    <Screen>
      <StepProgress total={3} current={1} />
      <View
        style={{
          flex: 1,
          maxWidth: isTablet ? 560 : undefined,
          alignSelf: isTablet ? 'center' : 'stretch',
          width: '100%',
        }}
      >
        {/* Editorial issue-number kicker — the way a Vogue cover marks
            "VOL. 01 · NO. 01" before the masthead. */}
        <Text style={[typography.eyebrow, { color: colors.primary, marginBottom: spacing.lg }]}>
          {t('app.name')} · {t('app.tagline')}
        </Text>
        <Text style={[typography.display, { color: colors.text }]}>
          {t('onboarding.welcome.headline1')}
        </Text>
        <Text
          style={[
            typography.displayItalic,
            { color: colors.primary, marginBottom: spacing.xl },
          ]}
        >
          {t('onboarding.welcome.headline2')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.xxl }]}>
          {t('onboarding.welcome.body')}
        </Text>

        {/* Language picker — editorial radio cards. Active card sports a
            sienna left rule + warm cream fill so it reads as "selected"
            without the standard checkbox affordance. */}
        <Text style={[typography.eyebrow, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {t('onboarding.welcome.pickLanguage')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {SUPPORTED_LOCALES.map((code) => {
            const active = selected === code;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => pickLocale(code as 'vi' | 'en')}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.surfaceMuted : colors.surface,
                  overflow: 'hidden',
                }}
              >
                {active ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: 3,
                      backgroundColor: colors.primary,
                    }}
                  />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text
                    style={[typography.h3, { color: colors.text }]}
                  >
                    {t(`settings.language.${code}`)}
                  </Text>
                  <Text style={[typography.italicAccent, { color: colors.textMuted }]}>
                    {code.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Button
        title={t('onboarding.welcome.cta')}
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('Basics')}
      />
    </Screen>
  );
}
