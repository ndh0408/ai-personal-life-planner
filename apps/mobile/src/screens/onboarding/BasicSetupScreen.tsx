import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppScreen, Button, Chip, Text, TextField, useToast } from '../../components/ui';
import { spacing } from '../../theme';
import type { OnboardingStackParamList } from '../../navigation/types';
import { profileService } from '../../services/api/profile.service';
import { readableError } from '../../utils/error';

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
  const toast = useToast();
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { preferredName: '', wakeTime: '06:30', sleepTime: '23:00' },
  });
  const wake = watch('wakeTime');
  const sleep = watch('sleepTime');

  // PATCH /profile so wakeTime / sleepTime / preferredName actually reach the
  // server. completeOnboarding marks the profile row done so the next launch
  // doesn't re-send the user through this step.
  const save = useMutation({
    mutationFn: (values: FormValues) =>
      profileService.update({
        preferredName: values.preferredName.trim() || null,
        usualWakeTime: values.wakeTime,
        usualSleepTime: values.sleepTime,
        completeOnboarding: true,
      }),
  });

  const onNext = handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      navigation.navigate('AISetup');
    } catch (e) {
      toast.show(readableError(e, t, 'onboarding'), 'danger');
    }
  });

  const onSkip = () => navigation.navigate('AISetup');

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

        <Button
          label={save.isPending ? t('common.loading') : t('onboarding.basicSetup.cta')}
          onPress={onNext}
          loading={save.isPending}
          disabled={save.isPending}
        />
        <Button label={t('common.skip')} variant="ghost" onPress={onSkip} disabled={save.isPending} />
      </View>
    </AppScreen>
  );
}
