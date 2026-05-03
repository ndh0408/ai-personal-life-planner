import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/v2';
import { Text } from './Text';

interface Props {
  /** 0..100 energy score. */
  score: number;
  size?: number;
  caption?: string;
}

/**
 * Hero "how am I right now" dial. Three-zone gradient: low (warning) →
 * mid (info) → high (success). The arc covers 270° starting bottom-left;
 * the gap at the bottom emphasizes the half-circle reading.
 */
export function EnergyDial({ score, size = 156, caption }: Props) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, score));
  const thickness = 12;
  const radius = (size - thickness) / 2;
  const arcAngle = 270;
  const circumference = (2 * Math.PI * radius * arcAngle) / 360;
  const filled = (circumference * clamped) / 100;

  const tier = clamped < 35 ? 'low' : clamped < 70 ? 'mid' : 'high';
  const ringColor =
    tier === 'low'
      ? t.color.status.warning.fg
      : tier === 'mid'
      ? t.color.status.info.fg
      : t.color.status.success.fg;

  // Rotate so the arc starts at bottom-left and ends at bottom-right with
  // a 90° gap. (-225° = start at 7 o'clock, sweep to 5 o'clock.)
  const rotation = -225;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="energyGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColor} stopOpacity={0.4} />
            <Stop offset="1" stopColor={ringColor} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          stroke={t.color.border.base}
          fill="none"
          strokeDasharray={`${circumference}, ${2 * Math.PI * radius - circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          stroke="url(#energyGrad)"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled}, ${2 * Math.PI * radius - filled}`}
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text variant="kicker" tone="tertiary">
          ENERGY
        </Text>
        <Text variant="displayL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
          {clamped}
        </Text>
        {caption ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
