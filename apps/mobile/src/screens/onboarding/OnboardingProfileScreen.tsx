import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '../../theme';
import { Screen, Input, Button } from '../../components/ui';
import { profileApi } from '../../services/api/profile.api';
import type { OnboardingScreenProps } from '../../navigation/types';

const Schema = z.object({
  fullName: z.string().min(1).max(60),
  age: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (v >= 1 && v <= 120), 'Enter a realistic age'),
  occupation: z.string().max(60).optional(),
});
type Form = z.input<typeof Schema>;

export function OnboardingProfileScreen({ navigation }: OnboardingScreenProps<'Profile'>) {
  const { colors, spacing } = useTheme();
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { fullName: '', age: undefined, occupation: '' },
  });

  const onSubmit = handleSubmit(async (raw) => {
    setSaving(true);
    try {
      const parsed = Schema.parse(raw);
      await profileApi.update(parsed as never);
      navigation.navigate('Goal');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>
          About you
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          Just the basics. You can update anything later.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Your name"
                value={value as string}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.fullName?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="age"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Age (optional)"
                value={value !== undefined ? String(value) : ''}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                error={errors.age?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="occupation"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="What do you do? (optional)"
                value={(value as string) ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.occupation?.message}
              />
            )}
          />
        </View>
      </ScrollView>
      <Button title="Continue" size="lg" fullWidth loading={saving} onPress={onSubmit} />
    </Screen>
  );
}
