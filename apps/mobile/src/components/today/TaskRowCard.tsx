import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Text } from '../ui';
import { spacing } from '../../theme';
import type { TaskRow } from '../../services/api/tasks.service';

interface Props {
  row: TaskRow;
  locale: 'vi' | 'en';
  /**
   * Both optional — when neither is supplied the card renders read-only,
   * which is the TodayScreen variant. The TasksScreen variant supplies both.
   */
  onComplete?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  /** TodayScreen wants HH:mm only, TasksScreen wants the full DD/MM HH:mm. */
  showFullDate?: boolean;
}

export function TaskRowCard({
  row,
  locale,
  onComplete,
  onDelete,
  disabled,
  showFullDate = false,
}: Props) {
  const { t } = useTranslation();
  const isDone = row.status === 'COMPLETED';
  const tone = isDone ? 'success' : row.priority === 'HIGH' ? 'danger' : 'neutral';
  const dueLabel = row.dueAt
    ? new Date(row.dueAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        ...(showFullDate ? { day: '2-digit', month: '2-digit' } : null),
      })
    : null;

  return (
    <Card>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text
            variant="bodyEm"
            style={{ textDecorationLine: isDone ? 'line-through' : 'none' }}
          >
            {row.title}
          </Text>
          {dueLabel ? <Text variant="caption">{dueLabel}</Text> : null}
        </View>
        <Badge label={t(`capture.priorities.${row.priority}`)} tone={tone} />
      </View>

      {(onComplete || onDelete) && !isDone ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {onComplete ? (
            <View style={{ flex: 1 }}>
              <Button
                label={t('tasks.completeCta')}
                onPress={onComplete}
                disabled={disabled}
                size="md"
              />
            </View>
          ) : null}
          {onDelete ? (
            <View style={{ flex: 1 }}>
              <Button
                label={t('common.delete')}
                variant="ghost"
                onPress={onDelete}
                disabled={disabled}
                size="md"
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {(onDelete && isDone) ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label={t('common.delete')}
            variant="ghost"
            onPress={onDelete}
            disabled={disabled}
            size="md"
          />
        </View>
      ) : null}
    </Card>
  );
}
