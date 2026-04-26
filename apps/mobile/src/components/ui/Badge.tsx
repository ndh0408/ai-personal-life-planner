import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  label: string;
  tone?: Tone;
}

const TONE_BG: Record<Tone, string> = {
  neutral: colors.surfaceAlt,
  success: 'rgba(127, 166, 107, 0.18)',
  warning: 'rgba(214, 162, 78, 0.18)',
  danger: 'rgba(201, 98, 74, 0.18)',
  info: 'rgba(107, 143, 168, 0.18)',
};
const TONE_FG: Record<Tone, string> = {
  neutral: colors.text.secondary,
  success: colors.status.success,
  warning: colors.status.warning,
  danger: colors.status.danger,
  info: colors.status.info,
};

export function Badge({ label, tone = 'neutral' }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: TONE_BG[tone] }]}>
      <Text style={[styles.label, { color: TONE_FG[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  label: { ...typography.micro, letterSpacing: 0.6, textTransform: 'uppercase' },
});
