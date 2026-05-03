import React from 'react';
import { Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useAurora } from './AuroraProvider';
import type { TypoVariant } from '@lifeos/aurora';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse';

interface Props extends TextProps {
  variant?: TypoVariant;
  tone?: Tone;
}

const FAMILY_FALLBACK: Record<'display' | 'text' | 'mono', { ios: string; android: string }> = {
  display: { ios: 'Times New Roman', android: 'serif' },
  text: { ios: 'System', android: 'sans-serif' },
  mono: { ios: 'Menlo', android: 'monospace' },
};

/**
 * FlowText — the canonical Aurora text. Variant picks size + family;
 * tone picks color from the active moment.
 *
 * Note on fonts: Fraunces / Inter Tight / JetBrains Mono are not bundled
 * in this build. We attempt the named family and the OS falls back to
 * `serif` / `System` / `Menlo`. R43 will bundle proper TTFs and update the
 * resolution to use them. The visual still reads correct because the
 * size/weight/tracking are the load-bearing tokens.
 */
export function FlowText({ variant = 'bodyM', tone = 'primary', style, ...rest }: Props) {
  const t = useAurora();
  const v = t.typography[variant];
  const color = (() => {
    switch (tone) {
      case 'accent':
        return t.palette.accent;
      case 'inverse':
        return t.palette.canvasA;
      case 'secondary':
        return t.palette.inkSecondary;
      case 'tertiary':
        return t.palette.inkTertiary;
      case 'primary':
      default:
        return t.palette.inkPrimary;
    }
  })();

  const fallback = FAMILY_FALLBACK[v.family];
  const family =
    Platform.OS === 'ios'
      ? t.fontFamily[v.family].ios
      : t.fontFamily[v.family].android;

  // The OS will silently fall back if the font isn't installed; we still
  // pass the desired family + a system fallback in fontVariant so numerics
  // stay tabular for monoData.
  const composed: TextStyle = {
    fontFamily: family || (Platform.OS === 'ios' ? fallback.ios : fallback.android),
    fontSize: v.size,
    lineHeight: v.lineHeight,
    fontWeight: v.weight,
    letterSpacing: v.trackingEm * v.size,
    color,
    ...(v.family === 'mono' ? { fontVariant: ['tabular-nums'] } : null),
  };

  return <RNText style={[composed, style]} {...rest} />;
}
