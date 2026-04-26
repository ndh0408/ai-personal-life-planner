import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeColors } from './colors';
import { getShadows, type Shadows } from './shadows';
import { motion, type Motion } from './motion';
import { layout, type Layout } from './layout';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

/**
 * Round 22 — "Editorial Calm" typography.
 *
 * Two voices:
 *   - **Fraunces** — variable serif with oldstyle figures + soft italic.
 *     Used for displays, headings, status chips, money amounts.
 *   - **Plus Jakarta Sans** — refined sans, generous x-height.
 *     Used for body, captions, button labels.
 *
 * Both are loaded in `App.tsx` before the splash hides — see
 * `useFraunces` / `useJakarta`. If the OTA load ever fails (no
 * network, etc.) RN falls back to the platform serif/sans which is
 * typographically close enough that the layout stays intact.
 *
 * Helpers:
 *   - `serif`, `sans` — explicit font families for one-off use.
 *   - `eyebrow` — small caps + extra letter-spacing, for section
 *     headers (e.g. "TODAY · MORNING").
 */
export const fonts = {
  serif: 'Fraunces_400Regular',
  serifMedium: 'Fraunces_500Medium',
  serifSemibold: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMediumItalic: 'Fraunces_500Medium_Italic',
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemibold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
} as const;

export const typography = {
  // Display — magazine-cover scale, soft serif italic option for hero.
  display: {
    fontFamily: fonts.serifSemibold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  displayItalic: {
    fontFamily: fonts.serifMediumItalic,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.4,
  },
  h1: { fontFamily: fonts.serifSemibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.serifSemibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.serifMedium, fontSize: 17, lineHeight: 23 },

  // Body — sans, 15/22 — comfortable reading rhythm.
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22 },

  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },

  // Eyebrow — small caps style: tracked-out, tiny, used for section
  // headers ("TODAY · MORNING"). RN can't true-fontFeature small-caps,
  // so we approximate with uppercase + letter-spacing.
  eyebrow: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },

  // Numbers — Fraunces oldstyle figures, slight italic. Tabular hint
  // keeps amounts column-aligned in finance cards.
  number: {
    fontFamily: fonts.serifSemibold,
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'] as const,
  },
  numberLarge: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'] as const,
  },

  // Italic accent — used for status chips and decorative quotes.
  italicAccent: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    lineHeight: 20,
  },
};

export type Theme = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fonts: typeof fonts;
  shadows: Shadows;
  motion: Motion;
  layout: Layout;
  isDark: boolean;
};

const defaultTheme: Theme = {
  colors: lightTheme,
  spacing,
  radius,
  typography,
  fonts,
  shadows: getShadows(false),
  motion,
  layout,
  isDark: false,
};

const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const value = useMemo<Theme>(
    () => ({
      colors: isDark ? darkTheme : lightTheme,
      spacing,
      radius,
      typography,
      fonts,
      shadows: getShadows(isDark),
      motion,
      layout,
      isDark,
    }),
    [isDark],
  );
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export { lightTheme, darkTheme };
export type { ThemeColors };
export {
  financeColor,
  healthColor,
  priorityColor,
  priorityToneFromEnum,
  recommendationDomainFromEnum,
  recommendationVisual,
} from './semantic';
export type {
  FinanceTone,
  HealthTone,
  PriorityTone,
  RecommendationDomain,
} from './semantic';
export { useResponsive, breakpoints } from './responsive';
export type { Breakpoint, Responsive } from './responsive';
