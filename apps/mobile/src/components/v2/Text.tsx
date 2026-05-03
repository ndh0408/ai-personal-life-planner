import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '../../theme/v2';
import { makeTextStyle, type TextVariant } from '../../theme/v2/typography';

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'link';
}

const TONE_KEY: Record<NonNullable<Props['tone']>, keyof ReturnType<typeof useTheme>['color']['text'] | 'accent'> = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  onAccent: 'onAccent',
  link: 'link',
  accent: 'accent', // resolved against accent.base, not text.*
};

/**
 * Tokenised Text. variant controls type scale; tone controls color. Both
 * read from the active scheme via ThemeProvider.
 */
export function Text({ variant = 'bodyM', tone = 'primary', style, ...rest }: Props) {
  const t = useTheme();
  const color =
    tone === 'accent'
      ? t.color.accent.base
      : t.color.text[TONE_KEY[tone] as keyof typeof t.color.text];
  return <RNText style={[makeTextStyle(variant), { color }, style]} {...rest} />;
}
