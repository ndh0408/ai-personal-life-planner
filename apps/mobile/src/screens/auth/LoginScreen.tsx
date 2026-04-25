import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button } from '../../components/ui';
import { useAuthStore } from '../../store/auth.store';
import { ApiError } from '../../services/api/client';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { AuthScreenProps } from '../../navigation/types';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type Form = z.infer<typeof Schema>;

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: Form) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (e) {
      const msg = e instanceof ApiError ? messageFor(e) : t('errors.UNKNOWN_ERROR');
      Alert.alert(t('auth.login.title'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 32, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>
          {t('auth.login.subtitle')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          {t('app.tagline')}
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('auth.login.email')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={errors.email ? t('errors.VALIDATION_FAILED') : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('auth.login.password')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                error={errors.password ? t('errors.VALIDATION_FAILED') : undefined}
              />
            )}
          />
        </View>

        <Button title={t('auth.login.submit')} loading={submitting} onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
        <Button
          title={t('auth.login.switchToRegister')}
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
