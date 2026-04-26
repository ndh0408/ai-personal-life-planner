import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { tasksService, type TaskPriority } from '../../services/api/tasks.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTask'>;

type DueChip = 'none' | 'today9' | 'tomorrow9' | 'tonight';

function dueIsoFor(chip: DueChip): string | null {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  switch (chip) {
    case 'today9':
      d.setHours(9);
      return d.toISOString();
    case 'tomorrow9':
      d.setDate(d.getDate() + 1);
      d.setHours(9);
      return d.toISOString();
    case 'tonight':
      d.setHours(20);
      return d.toISOString();
    case 'none':
    default:
      return null;
  }
}

export function AddTaskScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [due, setDue] = useState<DueChip>('none');

  const create = useMutation({
    mutationFn: () =>
      tasksService.create({
        title: title.trim(),
        priority,
        dueAt: dueIsoFor(due),
      }),
    onSuccess: () => {
      toast.show(t('tasks.created'), 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      navigation.goBack();
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const canSubmit = title.trim().length > 0 && !create.isPending;

  return (
    <AppScreen>
      <Text variant="kicker">{t('tasks.kicker')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('tasks.addTitle')}
      </Text>

      <Card style={{ gap: spacing.lg }}>
        <TextField
          label={t('tasks.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('tasks.placeholders.title')}
          autoFocus
        />

        <View>
          <Text variant="kicker" style={{ marginBottom: spacing.xs }}>
            {t('tasks.fields.priority')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['LOW', 'MEDIUM', 'HIGH'] as TaskPriority[]).map((p) => (
              <Chip
                key={p}
                label={t(`capture.priorities.${p}`)}
                tone="accent"
                selected={priority === p}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>
        </View>

        <View>
          <Text variant="kicker" style={{ marginBottom: spacing.xs }}>
            {t('tasks.fields.due')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(['none', 'today9', 'tonight', 'tomorrow9'] as DueChip[]).map((c) => (
              <Chip
                key={c}
                label={t(`tasks.dueChips.${c}`)}
                tone="accent"
                selected={due === c}
                onPress={() => setDue(c)}
              />
            ))}
          </View>
        </View>
      </Card>

      <View style={{ height: spacing.xl }} />

      <Button
        label={create.isPending ? t('common.loading') : t('tasks.saveCta')}
        onPress={() => create.mutate()}
        disabled={!canSubmit}
        loading={create.isPending}
      />
      <View style={{ height: spacing.sm }} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}
