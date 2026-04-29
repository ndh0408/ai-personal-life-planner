import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Text,
  TextField,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../components/ui';
import { readableError } from '../../utils/error';
import type { AuthStackParamList } from '../../navigation/types';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof Schema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const toast = useToast();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn(values);
    } catch (e) {
      toast.show(readableError(e, t, 'auth'), 'danger');
    }
  });

  return (
    <AppScreen>
      <Text variant="kicker">LifeOS AI</Text>
      <Text variant="display" style={{ marginTop: spacing.md }}>
        {t('auth.loginTitle')}
      </Text>
      <Text style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {t('auth.loginSubtitle')}
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
              onBlur={field.onBlur}
              error={fieldState.error ? t('auth.errors.validation_failed') : null}
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
              autoComplete="password"
              textContentType="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secret
              error={fieldState.error ? t('auth.errors.validation_failed') : null}
            />
          )}
        />
        <Button
          label={t('auth.loginCta')}
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
        <Text>{t('auth.noAccount')}</Text>
        <Text variant="link" onPress={() => navigation.navigate('Register')}>
          {t('auth.signUpLink')}
        </Text>
      </View>
    </AppScreen>
  );
}
