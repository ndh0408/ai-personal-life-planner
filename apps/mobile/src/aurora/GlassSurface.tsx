import React from 'react';
import { Platform, View, type ViewStyle, type StyleProp } from 'react-native';
import { useAurora } from './AuroraProvider';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Default 24 (space[6]). */
  pad?: keyof ReturnType<typeof useAurora>['space'];
  /** Corner radius. Default xl. */
  radius?: keyof ReturnType<typeof useAurora>['radius'];
  /** Glass tint intensity multiplier (1 = palette default). */
  intensity?: number;
  /** Inner glow stripe at the top edge — gives the glass a "lit-from-above" feel. */
  glow?: boolean;
}

/**
 * Frosted-glass surface. RN doesn't have a true backdrop-filter, so we
 * fake the look with:
 *   - semi-transparent palette tint over the canvas
 *   - 1px inner stroke at high alpha (the catch-light)
 *   - optional top-edge gradient line
 *
 * The illusion is maintained because:
 *   1) the canvas itself moves (drift) — eyes accept the tint as "blur"
 *   2) the catch-light + bottom shadow imply a 3D pane
 *
 * On iOS we also add a tiny shadow; on Android we skip it (looks heavy
 * over a gradient canvas).
 */
export function GlassSurface({
  children,
  style,
  pad = '6',
  radius = 'xl',
  intensity = 1,
  glow = true,
}: Props) {
  const t = useAurora();
  const tint = scaleAlpha(t.palette.glassTint, intensity);

  return (
    <View
      style={[
        {
          backgroundColor: tint,
          borderRadius: t.radius[radius],
          padding: t.space[pad],
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.32,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
            },
            android: { elevation: 0 },
          }),
        },
        style,
      ]}
    >
      {glow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: t.space['6'],
            right: t.space['6'],
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

/**
 * Take an `rgba(...)` string and multiply the alpha. Tint definitions in
 * the palette are written for default intensity 1.0; consumers tweak via
 * the prop without re-defining the color.
 */
function scaleAlpha(rgba: string, factor: number): string {
  const m = rgba.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return rgba;
  const parts = m[1].split(',').map((s) => s.trim());
  if (parts.length < 4) return rgba;
  const a = parseFloat(parts[3]);
  const next = Math.max(0, Math.min(1, a * factor));
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${next})`;
}
