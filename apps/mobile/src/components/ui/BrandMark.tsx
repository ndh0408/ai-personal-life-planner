/**
 * In-app rendering of the LifeOS launcher mark (round 33).
 *
 * Used by the splash overlay (a brief paint between system splash
 * dismissal and the first React render) and anywhere else we want the
 * brand mark in-band without using react-native-svg's <SvgXml>.
 *
 * Pure RN primitives — a sienna stem + a sienna ring approximated with
 * an outline-only View. No SVG dependency, no TTF, no PNG asset; sizes
 * arbitrarily on demand. The default 64dp matches the Settings header.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '../../theme';

interface Props {
  size?: number;
  /** Override colour. Defaults to brand sienna. */
  color?: string;
  /** Cream canvas behind the mark. Pass null for transparent. */
  background?: string | null;
}

const BRAND_SIENNA = '#C97B4A';
const BRAND_CANVAS = '#F4EFE7';

export function BrandMark({ size = 64, color = BRAND_SIENNA, background = BRAND_CANVAS }: Props) {
  // Mark sits inside the centre 80% of the canvas — same safe zone as the
  // Android adaptive icon. Stem on the left, ring on the right, dot in
  // the centre of the ring.
  const canvas = size;
  const stemW = canvas * 0.092;
  const stemH = canvas * 0.41;
  const stemX = canvas * 0.333;
  const stemY = canvas * 0.296;
  const ringR = canvas * 0.13;
  const ringStroke = canvas * 0.055;
  const ringCx = canvas * 0.63;
  const ringCy = canvas * 0.5;
  const dotR = canvas * 0.03;

  return (
    <View
      style={[
        {
          width: canvas,
          height: canvas,
          backgroundColor: background ?? 'transparent',
          borderRadius: canvas * 0.18,
        },
        styles.canvas,
      ]}
      accessibilityRole="image"
      accessibilityLabel="LifeOS AI"
    >
      {/* Stem */}
      <View
        style={{
          position: 'absolute',
          left: stemX,
          top: stemY,
          width: stemW,
          height: stemH,
          borderRadius: stemW / 2,
          backgroundColor: color,
        }}
      />
      {/* Ring (outline) */}
      <View
        style={{
          position: 'absolute',
          left: ringCx - ringR,
          top: ringCy - ringR,
          width: ringR * 2,
          height: ringR * 2,
          borderRadius: ringR,
          borderWidth: ringStroke,
          borderColor: color,
        }}
      />
      {/* Centre dot */}
      <View
        style={{
          position: 'absolute',
          left: ringCx - dotR,
          top: ringCy - dotR,
          width: dotR * 2,
          height: dotR * 2,
          borderRadius: dotR,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden' },
});

// Quiet the unused tokens import — kept ready for the cream/sienna
// references when the Settings header adopts BrandMark.
void tokens;
