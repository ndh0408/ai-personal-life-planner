import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { aurora, momentForHour, moments, type Moment, type MomentPalette } from '@lifeos/aurora';

/**
 * Aurora theme = current moment palette + scheme-agnostic tokens. The
 * moment refreshes every 5 minutes (cheap), so the canvas drifts with the
 * day without any explicit user action. Override-able via `momentOverride`
 * for tests / debug.
 */
export interface AuroraTheme {
  moment: Moment;
  palette: MomentPalette;
  space: typeof aurora.space;
  radius: typeof aurora.radius;
  hitSize: number;
  screenEdge: typeof aurora.screenEdge;
  motion: typeof aurora.motion;
  typography: typeof aurora.typography;
  fontFamily: typeof aurora.fontFamily;
  status: { success: string; warning: string; danger: string; info: string };
  kind: typeof import('@lifeos/aurora').kind;
}

const AuroraContext = createContext<AuroraTheme | null>(null);

interface Props {
  /** Force a moment for previews / debug. Defaults to live time. */
  momentOverride?: Moment;
  children: React.ReactNode;
}

export function AuroraProvider({ momentOverride, children }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (momentOverride) return;
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [momentOverride]);

  const value = useMemo<AuroraTheme>(() => {
    const moment = momentOverride ?? momentForHour(now.getHours());
    return {
      moment,
      palette: moments[moment],
      space: aurora.space,
      radius: aurora.radius,
      hitSize: aurora.hitSize,
      screenEdge: aurora.screenEdge,
      motion: aurora.motion,
      typography: aurora.typography,
      fontFamily: aurora.fontFamily,
      status: require('@lifeos/aurora').status,
      kind: require('@lifeos/aurora').kind,
    };
  }, [now, momentOverride]);

  return <AuroraContext.Provider value={value}>{children}</AuroraContext.Provider>;
}

export function useAurora(): AuroraTheme {
  const ctx = useContext(AuroraContext);
  if (!ctx) throw new Error('useAurora must be used inside <AuroraProvider>');
  return ctx;
}
