import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, LinearGradient } from 'react-native-svg';
import { useAurora } from './AuroraProvider';
import { FlowText } from './FlowText';

interface Props {
  /** 0..100 score. */
  score: number;
  size?: number;
  label?: string;
  caption?: string;
}

/**
 * OrbDial — replaces v2's EnergyDial. A glowing orb (radial gradient core
 * + outer ring) where the ring fill maps to the score. Calmer than the
 * activity-ring metaphor; reads as ambient state, not a metric to game.
 */
export function OrbDial({ score, size = 180, label, caption }: Props) {
  const t = useAurora();
  const clamped = Math.max(0, Math.min(100, score));
  const thickness = 6;
  const ringR = size / 2 - thickness;
  const orbR = size / 2 - thickness - 14;
  const circumference = 2 * Math.PI * ringR;
  const filled = (circumference * clamped) / 100;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orbCore" cx="35%" cy="30%" r="70%">
            <Stop offset="0" stopColor={t.palette.accentGlow} stopOpacity="0.95" />
            <Stop offset="0.6" stopColor={t.palette.accent} stopOpacity="0.6" />
            <Stop offset="1" stopColor={t.palette.canvasA} stopOpacity="0.0" />
          </RadialGradient>
          <LinearGradient id="orbRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.palette.accent} stopOpacity="1" />
            <Stop offset="1" stopColor={t.palette.accentGlow} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        <Circle cx={size / 2} cy={size / 2} r={orbR + 8} fill="url(#orbCore)" opacity={0.55} />
        <Circle cx={size / 2} cy={size / 2} r={orbR} fill="url(#orbCore)" />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringR}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringR}
          stroke="url(#orbRing)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${filled}, ${circumference - filled}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {label ? (
          <FlowText variant="displayM" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
            {label}
          </FlowText>
        ) : null}
        {caption ? (
          <FlowText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {caption}
          </FlowText>
        ) : null}
      </View>
    </View>
  );
}
