import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import type {
  DailyPlanItemPublic,
  DailyPlanItemStatus,
} from '../../services/api/planner.service';

interface Props {
  item: DailyPlanItemPublic;
  onToggle: (next: DailyPlanItemStatus) => void;
}

const TYPE_GLYPH: Record<string, string> = {
  TASK: '✓',
  MEAL: '🍚',
  REST: '💤',
  WORK: '💼',
  PERSONAL: '◇',
  HEALTH: '🌱',
  FINANCE: '💸',
  CUSTOM: '◇',
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function PlanItemRow({ item, onToggle }: Props) {
  const { t } = useTranslation();
  const done = item.status === 'COMPLETED';
  const skipped = item.status === 'SKIPPED';
  const next: DailyPlanItemStatus = done ? 'PENDING' : 'COMPLETED';
  const time = item.startAt ? `${formatTime(item.startAt)} – ${formatTime(item.endAt)}` : '';

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text variant="caption" style={styles.timeLabel}>
          {time}
        </Text>
      </View>
      <Pressable
        onPress={() => onToggle(next)}
        style={({ pressed }) => [
          styles.card,
          done && styles.done,
          skipped && styles.skipped,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={styles.glyphWrap}>
            <Text style={{ fontSize: 16 }}>{TYPE_GLYPH[item.type] ?? '◇'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="bodyEm"
              style={done ? { textDecorationLine: 'line-through', color: colors.text.muted } : null}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.status !== 'PENDING' ? (
              <Text variant="caption">
                {done ? t('common.ok') : t('common.skip')}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.dot, done && styles.dotDone, skipped && styles.dotSkipped]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  timeCol: { width: 86, paddingTop: spacing.md },
  timeLabel: { ...typography.caption, color: colors.text.muted, fontVariant: ['tabular-nums'] },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  glyphWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
  skipped: { opacity: 0.55 },
  pressed: { backgroundColor: colors.surfaceAlt },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  dotDone: { backgroundColor: colors.status.success, borderColor: colors.status.success },
  dotSkipped: { backgroundColor: colors.text.muted, borderColor: colors.text.muted },
});
