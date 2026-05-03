import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { tokens, type ColorScheme, type ColorTokens } from '@lifeos/design-tokens';

/**
 * Resolved theme = scheme-specific colors + scheme-agnostic everything else.
 * Components consume `useTheme()`; never import design-tokens directly.
 */
export interface Theme {
  scheme: ColorScheme;
  color: ColorTokens;
  space: typeof tokens.space;
  radius: typeof tokens.radius;
  hitSize: number;
  motion: typeof tokens.motion;
  elevation: typeof tokens.elevation;
  typography: typeof tokens.typography;
  fontFamily: typeof tokens.fontFamily;
}

const ThemeContext = createContext<Theme | null>(null);

interface Props {
  /** Override system scheme. Useful for screen-level dark/light forcing. */
  scheme?: ColorScheme;
  children: React.ReactNode;
}

export function ThemeProvider({ scheme, children }: Props) {
  const systemScheme = useRNColorScheme();
  const effective: ColorScheme = scheme ?? (systemScheme === 'light' ? 'light' : 'dark');

  const value = useMemo<Theme>(
    () => ({
      scheme: effective,
      color: tokens.color[effective],
      space: tokens.space,
      radius: tokens.radius,
      hitSize: tokens.hitSize,
      motion: tokens.motion,
      elevation: tokens.elevation,
      typography: tokens.typography,
      fontFamily: tokens.fontFamily,
    }),
    [effective],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}

export function useColorScheme(): ColorScheme {
  return useTheme().scheme;
}
