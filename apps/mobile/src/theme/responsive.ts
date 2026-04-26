import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoints used throughout the app.
 *
 * The app's primary surface is mobile, but per Round 21 we also want
 * tablets (`supportsTablet: true` in `app.config.ts`) and large phones
 * to lay out wider grids, two-column finance/health pairs, and roomy
 * onboarding panes. Breakpoints are deliberately conservative — they
 * fire at widths most physical devices actually expose:
 *
 *   - `xs`  ≤ 360px — small phones (older Android, iPhone SE 1st gen)
 *   - `sm`  361–479px — typical phones in portrait
 *   - `md`  480–767px — large phones (iPhone Pro Max), small tablets in portrait
 *   - `lg`  768–1023px — tablets in portrait, foldables half-open
 *   - `xl`  ≥ 1024px — tablets in landscape, foldables open, web
 */
export const breakpoints = {
  xs: 0,
  sm: 361,
  md: 480,
  lg: 768,
  xl: 1024,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export interface Responsive {
  /** Live width in DP. */
  width: number;
  /** Live height in DP. */
  height: number;
  /** Currently active breakpoint. */
  bp: Breakpoint;
  /** True when the device is at least this wide. */
  atLeast: (b: Breakpoint) => boolean;
  /** True when the device is below this width. */
  below: (b: Breakpoint) => boolean;
  /** Tablet-or-wider convenience. */
  isTablet: boolean;
  /** Small-phone convenience. */
  isCompact: boolean;
  /** Number of columns to use for grid layouts (quick actions, stat cards). */
  gridColumns: 2 | 3 | 4;
  /**
   * Pick a value based on breakpoint with fallback chain (smaller →
   * larger picks the largest matching key).
   */
  pick: <T>(values: Partial<Record<Breakpoint, T>>) => T | undefined;
}

/**
 * Reactive hook — re-renders on rotation / window resize. Backed by
 * `useWindowDimensions()` which is already optimised by RN.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo<Responsive>(() => {
    const bp: Breakpoint =
      width >= breakpoints.xl
        ? 'xl'
        : width >= breakpoints.lg
          ? 'lg'
          : width >= breakpoints.md
            ? 'md'
            : width >= breakpoints.sm
              ? 'sm'
              : 'xs';

    const atLeast = (b: Breakpoint) => width >= breakpoints[b];
    const below = (b: Breakpoint) => width < breakpoints[b];
    const isTablet = atLeast('lg');
    const isCompact = below('sm');
    const gridColumns: 2 | 3 | 4 = isTablet ? 4 : atLeast('md') ? 3 : 2;

    const pick = <T>(values: Partial<Record<Breakpoint, T>>): T | undefined => {
      const order: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];
      const startIdx = order.indexOf(bp);
      // Walk from current breakpoint downward to find the first defined value.
      for (let i = startIdx; i < order.length; i++) {
        if (values[order[i]] !== undefined) return values[order[i]];
      }
      // Fallback — walk upward.
      for (let i = startIdx - 1; i >= 0; i--) {
        if (values[order[i]] !== undefined) return values[order[i]];
      }
      return undefined;
    };

    return { width, height, bp, atLeast, below, isTablet, isCompact, gridColumns, pick };
  }, [width, height]);
}
