import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { CreateHabitSchema, type CreateHabitInput } from '@planner/shared';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { useTheme } from '../../theme';
import { habitsApi } from '../../services/api/habits.api';

export function CreateHabitScreen() {
  const { spacing } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateHabitInput>({
    resolver: zodResolver(CreateHabitSchema),
    defaultValues: { name: '', frequency: 'DAILY', targetCount: 1 },
  });
  const freq = watch('frequency');

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      await habitsApi.create(values);
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Habit name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Description (optional)"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['DAILY', 'WEEKLY', 'CUSTOM'] as const).map((f) => (
              <Chip
                key={f}
                label={f}
                selected={freq === f}
                onPress={() => setValue('frequency', f)}
              />
            ))}
          </View>
          <Controller
            control={control}
            name="targetCount"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Target per period"
                value={String(value ?? 1)}
                onChangeText={(t) => onChange(Number(t) || 1)}
                onBlur={onBlur}
                keyboardType="number-pad"
              />
            )}
          />
        </View>
      </ScrollView>
      <Button title="Create habit" size="lg" fullWidth loading={saving} onPress={onSubmit} />
    </Screen>
  );
}
