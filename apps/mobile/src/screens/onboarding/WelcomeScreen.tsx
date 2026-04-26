import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, Button, Chip, Text } from '../../components/ui';
import { spacing } from '../../theme';
import { i18n } from '../../i18n';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t, i18n: { language } } = useTranslation();

  const switchLanguage = (next: 'vi' | 'en') => {
    void i18n.changeLanguage(next);
  };

  return (
    <AppScreen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ marginTop: spacing['2xl'] }}>
          <Text variant="kicker">{t('onboarding.welcome.kicker')}</Text>
          <Text variant="display" style={{ marginTop: spacing.lg, fontSize: 40, lineHeight: 46 }}>
            {t('onboarding.welcome.title')}
          </Text>
          <Text style={{ marginTop: spacing.xl, fontSize: 17, lineHeight: 26 }}>
            {t('onboarding.welcome.body')}
          </Text>

          <View style={{ marginTop: spacing['2xl'] }}>
            <Text variant="caption" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('onboarding.welcome.languageLabel')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                label={t('settings.languageVi')}
                tone="accent"
                selected={language === 'vi'}
                onPress={() => switchLanguage('vi')}
              />
              <Chip
                label={t('settings.languageEn')}
                tone="accent"
                selected={language === 'en'}
                onPress={() => switchLanguage('en')}
              />
            </View>
          </View>
        </View>
        <Button
          label={t('onboarding.welcome.cta')}
          size="lg"
          onPress={() => navigation.navigate('BasicSetup')}
        />
      </View>
    </AppScreen>
  );
}
