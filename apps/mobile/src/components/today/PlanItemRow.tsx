import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text, type IconName } from '../ui';
import { colors, radius, spacing, typography } from '../../theme';
import type {
  DailyPlanItemPublic,
  DailyPlanItemStatus,
} from '../../services/api/planner.service';

interface Props {
  item: DailyPlanItemPublic;
  onToggle: (next: DailyPlanItemStatus) => void;
  /** Hide the trailing connector line (last item in the timeline). */
  isLast?: boolean;
  /** Highlight as the slot the user is currently in. */
  isCurrent?: boolean;
}

const ICON_FOR: Record<string, IconName> = {
  TASK: 'checkmark-circle-outline',
  MEAL: 'restaurant-outline',
  REST: 'moon-outline',
  WORK: 'flash-outline',
  PERSONAL: 'happy-outline',
  HEALTH: 'pulse-outline',
  FINANCE: 'cash-outline',
  CUSTOM: 'pricetag-outline',
};

const TINT_FOR: Record<string, string> = {
  TASK: colors.status.info,
  MEAL: colors.status.success,
  REST: '#9085C7',
  WORK: colors.accent.base,
  PERSONAL: colors.status.warning,
  HEALTH: colors.income.base,
  FINANCE: colors.expense.base,
  CUSTOM: colors.text.secondary,
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function PlanItemRow({ item, onToggle, isLast = false, isCurrent = false }: Props) {
  const { t } = useTranslation();
  const done = item.status === 'COMPLETED';
  const skipped = item.status === 'SKIPPED';
  const next: DailyPlanItemStatus = done ? 'PENDING' : 'COMPLETED';
  const time = item.startAt ? `${formatTime(item.startAt)} – ${formatTime(item.endAt)}` : '';

  const tint = TINT_FOR[item.type] ?? colors.text.secondary;
  const icon: IconName = ICON_FOR[item.type] ?? 'pricetag-outline';

  return (
    <View style={styles.row}>
      {/* Time + timeline rail */}
      <View style={styles.timeCol}>
        <Text variant="caption" style={styles.timeLabel}>
          {time}
        </Text>
        <View style={styles.rail}>
          <View
            style={[
              styles.dot,
              { borderColor: tint, backgroundColor: done ? tint : 'transparent' },
              isCurrent && { borderWidth: 3, shadowColor: tint },
            ]}
          />
          {!isLast ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
        </View>
      </View>

      <Pressable
        onPress={() => onToggle(next)}
        style={({ pressed }) => [
          styles.card,
          done && styles.done,
          skipped && styles.skipped,
          isCurrent && { borderColor: tint },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconHalo, { backgroundColor: tint + '22' }]}>
          <Icon name={icon} size={18} color={tint} />
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
        {done ? (
          <Icon name="checkmark-circle-outline" size={20} color={colors.status.success} />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  timeCol: {
    width: 76,
    paddingTop: spacing.md,
    alignItems: 'flex-end',
  },
  timeLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  rail: {
    position: 'absolute',
    right: -10,
    top: 8,
    bottom: -spacing.md,
    alignItems: 'center',
    width: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
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
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  iconHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
  skipped: { opacity: 0.55 },
  pressed: { backgroundColor: colors.surfaceAlt, transform: [{ scale: 0.99 }] },
});
