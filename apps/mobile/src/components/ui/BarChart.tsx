import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

type Bar = { label: string; value: number; caption?: string };

type Props = {
  data: Bar[];
  height?: number;
  tone?: 'default' | 'warning' | 'success';
  /** Force a Y-axis cap. When null, we use the data max. */
  max?: number;
  /** Hide labels when the chart is too narrow. */
  compact?: boolean;
};

/**
 * Dependency-free vertical bar chart.
 * - Each bar is a flex column; bar height is proportional to (value / max).
 * - Zero-value bars render as a thin outline so the user still sees the slot.
 * - `tone` lightly tints the fill; full-featured charts belong to a future lib.
 */
export function BarChart({ data, height = 120, tone = 'default', max, compact }: Props) {
  const { colors, spacing, radius, typography } = useTheme();
  const peak = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  const fill =
    tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.primary;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.xs,
          height,
          marginBottom: spacing.xs,
        }}
      >
        {data.map((bar, i) => {
          const ratio = bar.value <= 0 ? 0 : Math.min(1, bar.value / peak);
          const barHeight = Math.max(2, ratio * height);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View
                style={{
                  width: '100%',
                  height: barHeight,
                  backgroundColor: bar.value > 0 ? fill : 'transparent',
                  borderColor: colors.border,
                  borderWidth: bar.value > 0 ? 0 : 1,
                  borderRadius: radius.sm,
                }}
              />
            </View>
          );
        })}
      </View>
      {!compact ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {data.map((bar, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[typography.small, { color: colors.textMuted }]}>{bar.label}</Text>
              {bar.caption ? (
                <Text style={[typography.small, { color: colors.textMuted }]}>{bar.caption}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
