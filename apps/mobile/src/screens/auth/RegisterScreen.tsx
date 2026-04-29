import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen, Button, Text, TextField, useToast } from '../../components/ui';
import { spacing } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { readableError } from '../../utils/error';
import type { AuthStackParamList } from '../../navigation/types';

const Schema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80).optional().or(z.literal('')),
  password: z.string().min(8, 'min8'),
});
type FormValues = z.infer<typeof Schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const toast = useToast();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', displayName: '', password: '' },
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp({
        email: values.email,
        password: values.password,
        displayName: values.displayName?.trim() || undefined,
      });
    } catch (e) {
      toast.show(readableError(e, t, 'auth'), 'danger');
    }
  });

  return (
    <AppScreen>
      <Text variant="kicker">LifeOS AI</Text>
      <Text variant="display" style={{ marginTop: spacing.md }}>
        {t('auth.registerTitle')}
      </Text>
      <Text style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {t('auth.registerSubtitle')}
      </Text>

      <View style={{ gap: spacing.lg }}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error ? t('auth.errors.validation_failed') : null}
            />
          )}
        />
        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label={t('auth.displayName')}
              placeholder={t('auth.displayNamePlaceholder')}
              autoCapitalize="words"
              value={field.value ?? ''}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="new-password"
              textContentType="newPassword"
              value={field.value}
              onChangeText={field.onChange}
              secret
              error={fieldState.error ? t('auth.errors.validation_failed') : null}
            />
          )}
        />
        <Button
          label={t('auth.registerCta')}
          onPress={onSubmit}
          loading={formState.isSubmitting}
          disabled={formState.isSubmitting}
        />
      </View>

      <View
        style={{
          marginTop: spacing['2xl'],
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.xs,
        }}
      >
        <Text>{t('auth.hasAccount')}</Text>
        <Text variant="link" onPress={() => navigation.navigate('Login')}>
          {t('auth.signInLink')}
        </Text>
      </View>
    </AppScreen>
  );
}
