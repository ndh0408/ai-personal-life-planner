import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Card } from './Card';

type Props = {
  title: string;
  value: string | number | null;
  trend?: 'UP' | 'FLAT' | 'DOWN' | 'UNKNOWN';
  subtitle?: string;
};

const TREND_ARROW: Record<NonNullable<Props['trend']>, string> = {
  UP: '↑',
  FLAT: '·',
  DOWN: '↓',
  UNKNOWN: '',
};

/**
 * Single metric card for insight/score tiles.
 * `value=null` renders as "—" so empty data doesn't imply zero.
 */
export function InsightCard({ title, value, trend, subtitle }: Props) {
  const { colors, spacing, typography } = useTheme();
  const accent =
    trend === 'UP'
      ? colors.success
      : trend === 'DOWN'
        ? colors.danger
        : colors.text;
  const display = value === null || value === undefined ? '—' : value;
  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xs }}>
        <Text style={[typography.h2, { color: accent }]}>{display}</Text>
        {trend && trend !== 'UNKNOWN' ? (
          <Text style={[typography.bodyStrong, { color: accent }]}>{TREND_ARROW[trend]}</Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      ) : null}
    </Card>
  );
}
