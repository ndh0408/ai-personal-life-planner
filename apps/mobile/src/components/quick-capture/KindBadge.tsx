import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, Text, type IconName } from '../ui';
import type { CaptureKind } from '../../services/api/capture.service';

interface Style {
  icon: IconName;
  bg: string;
  fg: string;
}

const STYLE_FOR: Record<CaptureKind, Style> = {
  EXPENSE: { icon: 'cash-outline', bg: colors.expense.soft, fg: colors.expense.base },
  INCOME: { icon: 'trending-up-outline', bg: colors.income.soft, fg: colors.income.base },
  MEAL: { icon: 'restaurant-outline', bg: 'rgba(127, 166, 107, 0.18)', fg: colors.status.success },
  TASK: { icon: 'checkmark-circle-outline', bg: 'rgba(107, 143, 168, 0.18)', fg: colors.status.info },
  SLEEP: { icon: 'moon-outline', bg: 'rgba(107, 89, 168, 0.18)', fg: '#9085C7' },
  MOOD: { icon: 'happy-outline', bg: 'rgba(214, 162, 78, 0.18)', fg: colors.status.warning },
  UNKNOWN: { icon: 'flash-outline', bg: colors.surfaceAlt, fg: colors.text.muted },
};

export function KindBadge({ kind }: { kind: CaptureKind }) {
  const { t } = useTranslation();
  const s = STYLE_FOR[kind];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Icon name={s.icon} size={14} color={s.fg} />
      <Text style={[styles.label, { color: s.fg }]}>{t(`capture.kinds.${kind}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: { ...typography.caption, fontWeight: '700' },
});
