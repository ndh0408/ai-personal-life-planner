import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { palette, typography } from './theme';

const styles = StyleSheet.create({
  kicker: {
    ...typography.kicker,
    color: palette.accent,
    textTransform: 'uppercase',
  },
  display: { ...typography.display, color: palette.textPrimary },
  title: { ...typography.title, color: palette.textPrimary },
  body: { ...typography.body, color: palette.textSecondary },
  bodyStrong: { ...typography.bodyEm, color: palette.textPrimary },
  caption: { ...typography.caption, color: palette.textMuted },
  link: { ...typography.bodyEm, color: palette.accent },
});

export const Kicker = (p: TextProps) => <Text {...p} style={[styles.kicker, p.style]} />;
export const Display = (p: TextProps) => <Text {...p} style={[styles.display, p.style]} />;
export const Title = (p: TextProps) => <Text {...p} style={[styles.title, p.style]} />;
export const Body = (p: TextProps) => <Text {...p} style={[styles.body, p.style]} />;
export const BodyStrong = (p: TextProps) => <Text {...p} style={[styles.bodyStrong, p.style]} />;
export const Caption = (p: TextProps) => <Text {...p} style={[styles.caption, p.style]} />;
export const Link = (p: TextProps) => <Text {...p} style={[styles.link, p.style]} />;
