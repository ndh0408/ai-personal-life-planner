/**
 * Aurora motion — spring physics for everything. No linear easings here;
 * the canvas should feel alive.
 */

export const duration = {
  instant: 0,
  micro: 200,
  standard: 320,
  hero: 520,
  /** Breathing-cycle for ambient elements (gradient drift, idle dot). */
  breath: 4800,
} as const;
export type Duration = keyof typeof duration;

export const easing = {
  /** Smooth in-out — main screen transitions. */
  smooth: [0.25, 0.1, 0.25, 1] as const,
  /** Soft launch — sheets coming up. */
  rise: [0.16, 0.84, 0.34, 1] as const,
  /** Gentle landing — bottom sheet dismiss. */
  fall: [0.5, 0, 0.75, 0] as const,
} as const;
export type Easing = keyof typeof easing;

/** Reanimated `withSpring` configs. */
export const spring = {
  /** Default — soft, reassuring. Sheets, modals, page transitions. */
  soft: { damping: 20, stiffness: 180, mass: 1.0 },
  /** Snappy — chips, toggles, immediate feedback. */
  snappy: { damping: 24, stiffness: 360, mass: 0.7 },
  /** Bouncy — celebratory moments, playful confirms. */
  bouncy: { damping: 10, stiffness: 200, mass: 1.0 },
  /** Gentle drift — for breathing/idle motions. */
  drift: { damping: 28, stiffness: 60, mass: 1.4 },
} as const;
export type Spring = keyof typeof spring;

export const stagger = { tight: 28, base: 56, loose: 90 } as const;
export type Stagger = keyof typeof stagger;
