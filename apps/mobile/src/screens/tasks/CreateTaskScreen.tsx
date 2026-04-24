import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { CreateTaskSchema, type CreateTaskInput } from '@planner/shared';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { tasksApi } from '../../services/api/tasks.api';

export function CreateTaskScreen() {
  const { spacing } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: { title: '', description: '', priority: 'MEDIUM' },
  });

  const priority = watch('priority');

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      await tasksApi.create(values);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Title"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.title?.message}
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
                multiline
                style={{ minHeight: 80 }}
              />
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Category (optional)"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected={priority === p}
                  onPress={() => setValue('priority', p)}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <Button title="Create task" size="lg" fullWidth loading={saving} onPress={onSubmit} />
    </Screen>
  );
}
