import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/v2';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Override stroke + gradient hue. Default: theme accent. */
  color?: string;
  /** When true, draws a subtle area fill under the line. */
  filled?: boolean;
  /** Padding around the path so end-caps aren't clipped. */
  padding?: number;
}

/**
 * Tiny line chart for inline metric trends (7d sleep, 30d spending). Smooth
 * curves via Catmull-Rom-to-bezier; gradient fill under the curve when
 * `filled`.
 */
export function Sparkline({
  data,
  width = 220,
  height = 64,
  color,
  filled = true,
  padding = 4,
}: Props) {
  const t = useTheme();
  const stroke = color ?? t.color.accent.base;

  const { linePath, areaPath } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '' };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    const stepX = innerW / (data.length - 1);
    const points = data.map((v, i) => ({
      x: padding + i * stepX,
      y: padding + innerH - ((v - min) / span) * innerH,
    }));

    const line = points.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} Q ${cx} ${prev.y} ${cx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
    }, '');

    const area = `${line} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    return { linePath: line, areaPath: area };
  }, [data, width, height, padding]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {filled && areaPath ? (
          <>
            <Defs>
              <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#sparkFill)" />
          </>
        ) : null}
        <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
