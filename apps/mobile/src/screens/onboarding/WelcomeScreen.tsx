import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, Button, Text } from '../../components/ui';
import { spacing } from '../../theme';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  return (
    <AppScreen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ marginTop: spacing['3xl'] }}>
          <Text variant="kicker">{t('onboarding.welcome.kicker')}</Text>
          <Text variant="display" style={{ marginTop: spacing.lg, fontSize: 40, lineHeight: 46 }}>
            {t('onboarding.welcome.title')}
          </Text>
          <Text style={{ marginTop: spacing.xl, fontSize: 17, lineHeight: 26 }}>
            {t('onboarding.welcome.body')}
          </Text>
        </View>
        <Button label={t('onboarding.welcome.cta')} size="lg" onPress={() => navigation.navigate('BasicSetup')} />
      </View>
    </AppScreen>
  );
}
