import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CreateHabitSchema,
  type CreateHabitInput,
  type UpdateHabitInput,
  type HabitFrequencySchema as FreqSchemaType,
  type Habit,
} from '@planner/shared';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip, Loading, ErrorView } from '../../components/ui';
import { habitsApi } from '../../services/api/habits.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { RootStackParamList } from '../../navigation/types';

type Freq = 'DAILY' | 'WEEKLY' | 'CUSTOM';
const FREQS: Freq[] = ['DAILY', 'WEEKLY', 'CUSTOM'];

const COLOR_PALETTE = [
  '#22D3EE', // cyan
  '#A78BFA', // violet
  '#F87171', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#6366F1', // indigo
];

const ICON_SET = ['🔁', '💧', '🧘', '💪', '📚', '🏃', '🛏', '🥗', '💰', '✍️'];

type Route = RouteProp<RootStackParamList, 'CreateHabit'>;

export function CreateHabitScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const habitId = (route.params as { habitId?: string } | undefined)?.habitId;
  const isEdit = !!habitId;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editingQ = useQuery({
    enabled: isEdit,
    queryKey: ['habits', habitId],
    queryFn: async (): Promise<Habit | null> => {
      const all = await habitsApi.list();
      return all.find((h) => h.id === habitId) ?? null;
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateHabitInput & { isActive?: boolean }>({
    resolver: zodResolver(CreateHabitSchema),
    defaultValues: {
      name: '',
      description: '',
      frequency: 'DAILY',
      targetCount: 1,
      color: COLOR_PALETTE[0],
      icon: '🔁',
      isActive: true,
    } as CreateHabitInput & { isActive?: boolean },
  });

  useEffect(() => {
    if (!editingQ.data) return;
    const h = editingQ.data;
    reset({
      name: h.name,
      description: h.description ?? '',
      frequency: h.frequency,
      targetCount: h.targetCount,
      color: h.color ?? COLOR_PALETTE[0],
      icon: h.icon ?? '🔁',
      isActive: h.isActive,
    } as CreateHabitInput & { isActive?: boolean });
  }, [editingQ.data, reset]);

  const frequency = watch('frequency');
  const targetCount = watch('targetCount');
  const color = watch('color');
  const icon = watch('icon');
  const isActive = watch('isActive');

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const payload: CreateHabitInput = {
        name: values.name,
        description: values.description?.trim() || undefined,
        frequency: values.frequency,
        targetCount: Number(values.targetCount) || 1,
        color: values.color || undefined,
        icon: values.icon || undefined,
      };
      if (isEdit) {
        const update: UpdateHabitInput = {
          ...payload,
          isActive: (values as { isActive?: boolean }).isActive,
        };
        await habitsApi.update(habitId!, update);
      } else {
        await habitsApi.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
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
    Alert.alert(t('habits.confirmDelete.title'), t('habits.confirmDelete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await habitsApi.remove(habitId!);
            queryClient.invalidateQueries({ queryKey: ['habits'] });
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (isEdit && editingQ.isLoading) return <Loading />;
  if (isEdit && editingQ.error) {
    return <ErrorView message={translateError(editingQ.error)} onRetry={() => editingQ.refetch()} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {isEdit ? t('habits.editTitle') : t('habits.createTitle')}
        </Text>

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('habits.form.name')}
                placeholder={t('habits.form.namePlaceholder')}
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('habits.form.description')}
                placeholder={t('habits.form.descriptionPlaceholder')}
                value={value ?? ''}
                onChangeText={onChange}
                multiline
              />
            )}
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('habits.form.frequency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {FREQS.map((f) => (
                <Chip
                  key={f}
                  label={t(`habits.frequency.${f}`)}
                  selected={frequency === f}
                  onPress={() => setValue('frequency', f as never)}
                />
              ))}
            </View>
          </View>

          <Controller
            control={control}
            name="targetCount"
            render={({ field: { value, onChange } }) => (
              <Input
                label={t('habits.form.targetCount')}
                placeholder="1"
                value={value ? String(value) : ''}
                onChangeText={(v) => onChange(Number(v.replace(/[^\d]/g, '')) || 1)}
                keyboardType="number-pad"
              />
            )}
          />

          {/* Color picker */}
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('habits.form.color')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {COLOR_PALETTE.map((c) => {
                const selected = color === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setValue('color', c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: c,
                      borderWidth: selected ? 3 : 0,
                      borderColor: colors.text,
                    }}
                  />
                );
              })}
            </View>
          </View>

          {/* Icon picker */}
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('habits.form.icon')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {ICON_SET.map((i) => {
                const selected = icon === i;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setValue('icon', i)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{i}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {isEdit ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t('habits.form.isActive')}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {t('habits.form.isActiveHint')}
                </Text>
              </View>
              <Switch
                value={isActive ?? true}
                onValueChange={(v) => setValue('isActive', v)}
              />
            </View>
          ) : null}

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
