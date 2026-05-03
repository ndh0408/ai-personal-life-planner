import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/v2';
import { Text } from './Text';

interface Props {
  /** 0..1 fill ratio. */
  value: number;
  size?: number;
  thickness?: number;
  /** Center label, e.g. "78%" or "7.4h". */
  label?: string;
  caption?: string;
  /** Override stroke color. Default: theme accent. */
  color?: string;
}

/**
 * Activity-ring-like progress dial. Used for energy / sleep / habit
 * completion. Single ring; for double-rings stack two of these.
 */
export function MetricRing({ value, size = 92, thickness = 8, label, caption, color }: Props) {
  const t = useTheme();
  const stroke = color ?? t.color.accent.base;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = circumference * clamped;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          stroke={t.color.border.base}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash}, ${circumference - dash}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {label ? (
          <Text variant="titleL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
            {label}
          </Text>
        ) : null}
        {caption ? (
          <Text variant="caption" tone="tertiary">
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
