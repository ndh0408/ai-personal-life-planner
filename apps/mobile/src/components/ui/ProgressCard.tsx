import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Card } from './Card';

type Props = {
  title: string;
  current: number;
  target: number;
  currentLabel?: string;
  subtitle?: string;
  tone?: 'default' | 'warning' | 'danger';
};

/**
 * Linear progress bar + label. Used on saving-goal, personal-goal, and
 * budget cards. `tone="warning"` colors the filled portion amber; "danger"
 * colors red when a budget / saving is lagging.
 */
export function ProgressCard({ title, current, target, currentLabel, subtitle, tone = 'default' }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const fillColor =
    tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.primary;

  return (
    <Card>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      ) : null}
      <View
        style={{
          height: 8,
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.pill,
          marginTop: spacing.md,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: fillColor,
            borderRadius: radius.pill,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {currentLabel ?? `${Math.round(pct)}%`}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {target > 0 ? `/ ${target}` : ''}
        </Text>
      </View>
    </Card>
  );
}
