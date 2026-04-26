import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface Props {
  label: string;
  value: string;
  hint?: string;
  /** Direction indicator: '+' = up vs ref, '-' = down. */
  delta?: 'up' | 'down' | null;
}

export function StatCard({ label, value, hint, delta = null }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{value}</Text>
        {delta ? (
          <Text style={[styles.delta, delta === 'up' ? styles.up : styles.down]}>
            {delta === 'up' ? '▲' : '▼'}
          </Text>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  label: {
    ...typography.kicker,
    color: colors.text.muted,
    fontWeight: '600',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 4 },
  value: { ...typography.number, color: colors.text.primary },
  delta: { ...typography.caption },
  up: { color: colors.status.success },
  down: { color: colors.status.danger },
  hint: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
});
