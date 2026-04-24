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
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof Schema>;

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { colors, spacing } = useTheme();
  const login = useAuthStore((s) => s.login);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { email: 'demo@planner.local', password: 'demo1234' },
  });

  const onSubmit = async (values: Form) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not log in';
      Alert.alert('Login failed', msg);
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
          Welcome back
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          Plan today, then live it.
        </Text>

        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
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
                autoCorrect={false}
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

        <Button title="Log in" loading={submitting} onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
        <Button
          title="Create an account"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
          style={{ marginTop: spacing.md }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
