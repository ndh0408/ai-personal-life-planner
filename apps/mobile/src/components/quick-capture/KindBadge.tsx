import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import type { CaptureKind } from '../../services/api/capture.service';

const STYLE_FOR: Record<CaptureKind, { glyph: string; bg: string; fg: string }> = {
  EXPENSE: { glyph: '💸', bg: 'rgba(214, 162, 78, 0.18)', fg: colors.status.warning },
  INCOME: { glyph: '💰', bg: 'rgba(127, 166, 107, 0.18)', fg: colors.status.success },
  MEAL: { glyph: '🍚', bg: 'rgba(127, 166, 107, 0.18)', fg: colors.status.success },
  TASK: { glyph: '✓', bg: 'rgba(107, 143, 168, 0.18)', fg: colors.status.info },
  SLEEP: { glyph: '💤', bg: 'rgba(201, 123, 74, 0.16)', fg: colors.accent.base },
  MOOD: { glyph: '🎯', bg: 'rgba(201, 98, 74, 0.18)', fg: colors.status.danger },
  UNKNOWN: { glyph: '?', bg: colors.surfaceAlt, fg: colors.text.muted },
};

export function KindBadge({ kind }: { kind: CaptureKind }) {
  const { t } = useTranslation();
  const s = STYLE_FOR[kind];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.glyph, { color: s.fg }]}>{s.glyph}</Text>
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
  glyph: { fontSize: 14 },
  label: { ...typography.caption, fontWeight: '700' },
});
