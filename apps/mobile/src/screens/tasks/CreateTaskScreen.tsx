import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CreateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type Priority,
} from '@planner/shared';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip, Loading, ErrorView } from '../../components/ui';
import { tasksApi } from '../../services/api/tasks.api';
import { aiApi } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'CreateTask'>;

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

function iso(v?: string | null): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function CreateTaskScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const taskId = (route.params as { taskId?: string } | undefined)?.taskId;
  const isEdit = !!taskId;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const editingQ = useQuery({
    enabled: isEdit,
    queryKey: ['tasks', taskId],
    queryFn: () => tasksApi.get(taskId!),
  });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      estimatedMinutes: undefined,
      category: '',
      dueDate: undefined,
    },
  });

  // Seed the form once the edit fetch lands.
  useEffect(() => {
    if (!editingQ.data) return;
    reset({
      title: editingQ.data.title,
      description: editingQ.data.description ?? '',
      priority: editingQ.data.priority,
      estimatedMinutes: editingQ.data.estimatedMinutes ?? undefined,
      category: editingQ.data.category ?? '',
      dueDate: editingQ.data.dueDate ?? undefined,
    });
  }, [editingQ.data, reset]);

  const priority = watch('priority');
  const title = watch('title');
  const estimated = watch('estimatedMinutes');

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const payload: CreateTaskInput | UpdateTaskInput = {
        ...values,
        description: values.description?.trim() || undefined,
        category: values.category?.trim() || undefined,
        dueDate: iso(values.dueDate as string | null | undefined) as never,
        estimatedMinutes: values.estimatedMinutes ? Number(values.estimatedMinutes) : undefined,
      };
      if (isEdit) {
        await tasksApi.update(taskId!, payload as UpdateTaskInput);
      } else {
        await tasksApi.create(payload as CreateTaskInput);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  });

  const onDelete = () => {
    if (!isEdit) return;
    Alert.alert(
      t('tasks.confirmDelete.title'),
      t('tasks.confirmDelete.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await tasksApi.remove(taskId!);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              navigation.goBack();
            } catch (e) {
              Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  /**
   * AI helpers — each one routes through /ai/chat with a prompt that
   * describes the current task. The reply's `answer` is shown in a
   * confirm dialog: user must explicitly tap Apply before the form is
   * mutated. Nothing is written server-side by these helpers.
   */
  async function askAi(mode: 'split' | 'timing') {
    if (!title || title.trim().length < 3) {
      Alert.alert(t('tasks.ai.needTitleTitle'), t('tasks.ai.needTitleBody'));
      return;
    }
    setAiBusy(true);
    try {
      const message =
        mode === 'split'
          ? t('tasks.ai.splitPrompt', { title, minutes: estimated ?? '?' })
          : t('tasks.ai.timingPrompt', { title, minutes: estimated ?? '?' });
      const res = await aiApi.chat({ message, contextType: 'tasks-helper' });
      Alert.alert(
        mode === 'split' ? t('tasks.ai.splitTitle') : t('tasks.ai.timingTitle'),
        res.reply.answer,
        mode === 'split'
          ? [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('tasks.ai.copyToDescription'),
                onPress: () => {
                  // Append AI suggestion to description so user can review + edit.
                  const existing = (watch('description') ?? '').trim();
                  const suffix = `\n\n[AI] ${res.reply.answer}`;
                  (control._formValues as Record<string, unknown>).description =
                    existing + suffix;
                  reset({
                    ...(watch() as CreateTaskInput),
                    description: existing + suffix,
                  });
                },
              },
            ]
          : [{ text: t('common.ok') }],
      );
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setAiBusy(false);
    }
  }

  if (isEdit && editingQ.isLoading) return <Loading />;
  if (isEdit && editingQ.error) {
    return <ErrorView message={translateError(editingQ.error)} onRetry={() => editingQ.refetch()} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {isEdit ? t('tasks.editTitle') : t('tasks.createTitle')}
        </Text>

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('tasks.form.title')}
                placeholder={t('tasks.form.titlePlaceholder')}
                value={value}
                onChangeText={onChange}
                error={errors.title?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('tasks.form.description')}
                placeholder={t('tasks.form.descriptionPlaceholder')}
                value={value ?? ''}
                onChangeText={onChange}
                multiline
              />
            )}
          />
          <Controller
            control={control}
            name="dueDate"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('tasks.form.dueDate')}
                placeholder="2026-05-01 18:00"
                value={(value as string) ?? ''}
                onChangeText={onChange}
                autoCapitalize="none"
              />
            )}
          />
          <Controller
            control={control}
            name="estimatedMinutes"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('tasks.form.estimatedMinutes')}
                placeholder="45"
                value={value ? String(value) : ''}
                onChangeText={(v) => onChange(v ? Number(v.replace(/[^\d]/g, '')) : undefined)}
                keyboardType="number-pad"
              />
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('tasks.form.category')}
                placeholder={t('tasks.form.categoryPlaceholder')}
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('tasks.form.priority')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  label={t(`tasks.priority.${p}`)}
                  selected={priority === p}
                  onPress={() =>
                    reset({ ...(watch() as CreateTaskInput), priority: p })
                  }
                />
              ))}
            </View>
          </View>

          {/* AI helpers */}
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t('tasks.ai.sectionTitle')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                disabled={aiBusy}
                onPress={() => askAi('split')}
                style={{
                  flex: 1,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: aiBusy ? 0.5 : 1,
                }}
              >
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t('tasks.ai.split')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={aiBusy}
                onPress={() => askAi('timing')}
                style={{
                  flex: 1,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: aiBusy ? 0.5 : 1,
                }}
              >
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t('tasks.ai.timing')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {t('tasks.ai.disclaimer')}
            </Text>
          </View>

          {/* Buttons */}
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Button
              title={saving ? t('common.loading') : t('common.save')}
              onPress={onSubmit}
              disabled={saving}
            />
            {isEdit ? (
              <Button
                title={deleting ? t('common.loading') : t('common.delete')}
                variant="danger"
                onPress={onDelete}
                disabled={deleting}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
