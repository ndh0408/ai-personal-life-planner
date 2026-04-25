import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button } from '../../components/ui';
import { authApi } from '../../services/api/auth.api';
import { ApiError } from '../../services/api/client';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { AuthScreenProps } from '../../navigation/types';

const Schema = z
  .object({
    token: z.string().min(16),
    password: z.string().min(8).max(128).regex(/[a-z]/i, 'letter').regex(/\d/, 'digit'),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'mismatch',
  });
type Form = z.infer<typeof Schema>;

export function ResetPasswordScreen({ route, navigation }: AuthScreenProps<'ResetPassword'>) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { token: route.params?.token ?? '', password: '', confirm: '' },
  });

  const onSubmit = async (values: Form) => {
    setSubmitting(true);
    try {
      await authApi.resetPassword(values.token, values.password);
      Alert.alert(
        t('auth.resetPassword.title'),
        t('auth.resetPassword.successMessage'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('Login') }],
      );
    } catch (e) {
      const msg = e instanceof ApiError ? messageFor(e) : t('errors.UNKNOWN_ERROR');
      Alert.alert(t('auth.resetPassword.title'), msg);
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
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>
          {t('auth.resetPassword.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          {t('auth.resetPassword.subtitle')}
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <Controller
            control={control}
            name="token"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('auth.resetPassword.token')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.token ? t('errors.VALIDATION_FAILED') : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('auth.resetPassword.newPassword')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                error={errors.password ? t('auth.resetPassword.passwordPolicyHint') : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="confirm"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('auth.resetPassword.confirmPassword')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                error={errors.confirm ? t('auth.resetPassword.confirmMismatch') : undefined}
              />
            )}
          />
        </View>

        <Button title={t('auth.resetPassword.submit')} loading={submitting} onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
        <Button
          title={t('auth.forgotPassword.backToLogin')}
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
