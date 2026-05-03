import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useAurora } from './AuroraProvider';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Override stroke color. Default = moment accent. */
  color?: string;
  /** When true, draw a glowing dot at the latest point. */
  showHead?: boolean;
}

/**
 * Aurora sparkline — same Catmull-Rom curve as v2 but with a brighter
 * gradient fill + a glowing terminator dot. Reads as ambient pulse, not
 * a chart.
 */
export function AuroraSparkline({
  data,
  width = 240,
  height = 72,
  color,
  showHead = true,
}: Props) {
  const t = useAurora();
  const stroke = color ?? t.palette.accentGlow;

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '', lastPoint: null };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = 6;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const stepX = innerW / (data.length - 1);
    const points = data.map((v, i) => ({
      x: pad + i * stepX,
      y: pad + innerH - ((v - min) / span) * innerH,
    }));

    const line = points.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} Q ${cx} ${prev.y} ${cx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
    }, '');
    const last = points[points.length - 1];
    const area = `${line} L ${last.x} ${height - pad} L ${points[0].x} ${height - pad} Z`;
    return { linePath: line, areaPath: area, lastPoint: last };
  }, [data, width, height]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="auroraSparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.34} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {areaPath ? <Path d={areaPath} fill="url(#auroraSparkFill)" /> : null}
        <Path d={linePath} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {showHead && lastPoint ? (
          <>
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill={stroke} opacity={0.25} />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={stroke} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
