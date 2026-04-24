import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { formatMoneyByLocale } from '../../utils/format';
import { Card } from './Card';

type Props = {
  label: string;
  amount: number | string;
  currency?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  hint?: string;
};

export function MoneyCard({ label, amount, currency = 'VND', tone = 'default', hint }: Props) {
  const { colors, spacing, typography } = useTheme();
  const accent = {
    default: colors.text,
    positive: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[tone];

  return (
    <Card>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <Text style={[typography.h1, { color: accent }]} numberOfLines={1}>
        {formatMoneyByLocale(amount, currency)}
      </Text>
      {hint ? (
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}
