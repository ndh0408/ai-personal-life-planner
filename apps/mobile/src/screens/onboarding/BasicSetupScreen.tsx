import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppScreen, Button, Chip, Text, TextField } from '../../components/ui';
import { spacing } from '../../theme';
import type { OnboardingStackParamList } from '../../navigation/types';

const WAKE_PRESETS = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00'];
const SLEEP_PRESETS = ['22:00', '22:30', '23:00', '23:30', '00:00'];

interface FormValues {
  preferredName: string;
  wakeTime: string;
  sleepTime: string;
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BasicSetup'>;

export function BasicSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { preferredName: '', wakeTime: '06:30', sleepTime: '23:00' },
  });
  const wake = watch('wakeTime');
  const sleep = watch('sleepTime');

  const onNext = handleSubmit(async () => {
    // Profile persistence wires up in the next round; for now move forward.
    navigation.navigate('AISetup');
  });

  return (
    <AppScreen>
      <AppHeader
        kicker={t('onboarding.basicSetup.kicker')}
        title={t('onboarding.basicSetup.title')}
        onBack={() => navigation.goBack()}
      />
      <Text style={{ marginBottom: spacing.xl }}>{t('onboarding.basicSetup.subtitle')}</Text>

      <View style={{ gap: spacing.xl }}>
        <Controller
          control={control}
          name="preferredName"
          render={({ field }) => (
            <TextField
              label={t('onboarding.basicSetup.preferredName')}
              placeholder={t('onboarding.basicSetup.preferredNamePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="words"
            />
          )}
        />

        <View>
          <Text variant="caption" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('onboarding.basicSetup.wakeTime')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {WAKE_PRESETS.map((time) => (
              <Chip
                key={time}
                label={time}
                selected={wake === time}
                tone="accent"
                onPress={() => setValue('wakeTime', time)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text variant="caption" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('onboarding.basicSetup.sleepTime')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {SLEEP_PRESETS.map((time) => (
              <Chip
                key={time}
                label={time}
                selected={sleep === time}
                tone="accent"
                onPress={() => setValue('sleepTime', time)}
              />
            ))}
          </View>
        </View>

        <Button label={t('onboarding.basicSetup.cta')} onPress={onNext} />
      </View>
    </AppScreen>
  );
}
