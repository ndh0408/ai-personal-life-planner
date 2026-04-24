import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip, Loading, ErrorView } from '../../components/ui';
import {
  goalsApi,
  type GoalCategory,
  type CreateGoalInput,
  type PersonalGoal,
} from '../../services/api/goals.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import type { RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'CreateGoal'>;

const CATEGORIES: GoalCategory[] = [
  'HEALTH',
  'FINANCE',
  'CAREER',
  'STUDY',
  'RELATIONSHIP',
  'PERSONAL',
  'OTHER',
];

const PRIORITIES: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function CreateGoalScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const goalId = (route.params as { goalId?: string } | undefined)?.goalId;
  const isEdit = !!goalId;

  const editingQ = useQuery({
    enabled: isEdit,
    queryKey: ['goals', goalId],
    queryFn: () => goalsApi.getById(goalId!),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('PERSONAL');
  const [targetRaw, setTargetRaw] = useState('');
  const [currentRaw, setCurrentRaw] = useState('');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const g: PersonalGoal | undefined = editingQ.data;
    if (!g) return;
    setTitle(g.title);
    setDescription(g.description ?? '');
    setCategory(g.category);
    setTargetRaw(g.targetValue != null ? String(g.targetValue) : '');
    setCurrentRaw(g.currentValue != null ? String(g.currentValue) : '');
    setUnit(g.unit ?? '');
    setDeadline(g.deadline ? g.deadline.slice(0, 10) : '');
    setPriority(g.priority);
  }, [editingQ.data]);

  async function onSubmit() {
    if (!title.trim()) {
      Alert.alert(t('goals.invalid.title'), t('goals.invalid.titleBody'));
      return;
    }
    const trimmedDeadline = deadline.trim();
    if (trimmedDeadline && !DATE_RE.test(trimmedDeadline)) {
      Alert.alert(t('goals.invalid.title'), t('goals.invalid.deadlineBody'));
      return;
    }
    const target = parseNumber(targetRaw);
    const current = parseNumber(currentRaw);
    if (target !== undefined && current !== undefined && current > target) {
      Alert.alert(t('goals.invalid.title'), t('goals.invalid.progressBody'));
      return;
    }
    setSaving(true);
    try {
      const payload: CreateGoalInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        targetValue: target,
        currentValue: current,
        unit: unit.trim() || undefined,
        deadline: trimmedDeadline || undefined,
        priority,
      };
      if (isEdit) {
        await goalsApi.update(goalId!, payload);
      } else {
        await goalsApi.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      nav.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!isEdit) return;
    Alert.alert(t('goals.confirmDelete.title'), t('goals.confirmDelete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await goalsApi.remove(goalId!);
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            nav.goBack();
          } catch (e) {
            Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (isEdit && editingQ.isLoading) return <Loading />;
  if (isEdit && editingQ.error) {
    return <ErrorView message={translateError(editingQ.error)} onRetry={() => editingQ.refetch()} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {isEdit ? t('goals.editTitle') : t('goals.createTitle')}
        </Text>

        <View style={{ gap: spacing.md }}>
          <Input
            label={t('goals.form.title')}
            placeholder={t('goals.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('goals.form.description')}
            placeholder={t('goals.form.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('goals.form.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={t(`goals.category.${c}`)}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('goals.form.priority')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  label={t(`tasks.priority.${p}`)}
                  selected={priority === p}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('goals.form.targetValue')}
                placeholder="100"
                value={targetRaw}
                onChangeText={setTargetRaw}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t('goals.form.currentValue')}
                placeholder="0"
                value={currentRaw}
                onChangeText={setCurrentRaw}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Input
            label={t('goals.form.unit')}
            placeholder={t('goals.form.unitPlaceholder')}
            value={unit}
            onChangeText={setUnit}
          />
          <Text style={[typography.small, { color: colors.textMuted, marginTop: -spacing.xs }]}>
            {t('goals.form.numericHint')}
          </Text>

          <Input
            label={t('goals.form.deadline')}
            placeholder="2026-12-31"
            value={deadline}
            onChangeText={setDeadline}
            autoCapitalize="none"
          />

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
