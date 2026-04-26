import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Badge } from './Badge';

interface Props {
  title: string;
  body: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  badge?: string;
  onPress?: () => void;
}

export function InsightCard({ title, body, tone = 'info', badge, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {badge ? <Badge label={badge} tone={tone} /> : null}
      </View>
      <Text style={styles.body}>{body}</Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, { borderLeftColor: TONE_BAR[tone] }]}>{inner}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: TONE_BAR[tone] },
        pressed && styles.pressed,
      ]}
    >
      {inner}
    </Pressable>
  );
}

const TONE_BAR = {
  info: colors.status.info,
  success: colors.status.success,
  warning: colors.status.warning,
  danger: colors.status.danger,
} as const;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodyEm, color: colors.text.primary, flex: 1 },
  body: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
});
