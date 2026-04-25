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

const Schema = z.object({ email: z.string().email() });
type Form = z.infer<typeof Schema>;

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: Form) => {
    setSubmitting(true);
    try {
      // Backend always returns 202 even when the email doesn't match — same
      // success-toast either way (no enumeration leak).
      await authApi.forgotPassword(values.email);
      Alert.alert(
        t('auth.forgotPassword.title'),
        t('auth.forgotPassword.successMessage'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('Login') }],
      );
    } catch (e) {
      const msg = e instanceof ApiError ? messageFor(e) : t('errors.UNKNOWN_ERROR');
      Alert.alert(t('auth.forgotPassword.title'), msg);
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
          {t('auth.forgotPassword.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          {t('auth.forgotPassword.subtitle')}
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
        </View>

        <Button title={t('auth.forgotPassword.submit')} loading={submitting} onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
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
