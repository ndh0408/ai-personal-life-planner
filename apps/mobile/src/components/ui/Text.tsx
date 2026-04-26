import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { colors, typography } from '../../theme';

const VARIANTS = {
  display: { ...typography.display, color: colors.text.primary },
  title: { ...typography.title, color: colors.text.primary },
  heading: { ...typography.heading, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
  bodyEm: { ...typography.bodyEm, color: colors.text.primary },
  caption: { ...typography.caption, color: colors.text.muted },
  kicker: { ...typography.kicker, color: colors.accent.base },
  link: { ...typography.bodyEm, color: colors.accent.base },
  number: { ...typography.number, color: colors.text.primary },
} as const;

interface Props extends TextProps {
  variant?: keyof typeof VARIANTS;
}

export function Text({ variant = 'body', style, ...rest }: Props) {
  return <RNText {...rest} style={[VARIANTS[variant], style]} />;
}
