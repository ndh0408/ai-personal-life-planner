import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../theme';
import { Screen, Input, Button } from '../../components/ui';
import { useAuthStore } from '../../store/auth.store';
import { ApiError } from '../../services/api/client';
import type { AuthScreenProps } from '../../navigation/types';

const Schema = z.object({
  name: z.string().min(1, 'Required').max(60),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof Schema>;

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const { colors, spacing } = useTheme();
  const register = useAuthStore((s) => s.register);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values: Form) => {
    setSubmitting(true);
    try {
      await register({ ...values, timezone: 'Asia/Ho_Chi_Minh' });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not register';
      Alert.alert('Sign up failed', msg);
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
          Create account
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          Tell us a little about you.
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                error={errors.password?.message}
              />
            )}
          />
        </View>

        <Button title="Sign up" loading={submitting} onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
        <Button
          title="Back to login"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
