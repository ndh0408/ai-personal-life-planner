import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette } from './theme';

const colourFor = {
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  muted: palette.textMuted,
} as const;

export function StatusDot({ tone }: { tone: keyof typeof colourFor }) {
  return <View style={[styles.dot, { backgroundColor: colourFor[tone] }]} />;
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
});
