/**
 * Tiny line/area sparkline using react-native-svg. Designed for stat cards —
 * 7 data points typically, no axes, no labels. The caller passes raw values
 * and the colour; we handle scaling + smoothing.
 */
import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Optional accent fill at the bottom (gradient). */
  fillFrom?: string;
  fillTo?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = '#D08A5C',
  fillFrom,
  fillTo,
}: Props) {
  if (values.length < 2) {
    return <Svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = width / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * xStep;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = pts
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${height} L 0 ${height} Z`;

  const gradId = 'sparkfill';

  return (
    <Svg width={width} height={height}>
      {fillFrom && fillTo ? (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={fillFrom} />
            <Stop offset="100%" stopColor={fillTo} />
          </LinearGradient>
        </Defs>
      ) : null}
      {fillFrom && fillTo ? <Path d={areaPath} fill={`url(#${gradId})`} /> : null}
      <Path d={linePath} stroke={color} strokeWidth={1.75} fill="none" />
    </Svg>
  );
}
