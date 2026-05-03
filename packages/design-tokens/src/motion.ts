/**
 * Motion tokens. Reanimated 3 + native driver consumers.
 *
 * Rules of thumb:
 *   - micro (180ms): toggles, chips, ripples
 *   - standard (280ms): screen transitions, sheets
 *   - hero (420ms): onboarding, brand reveals
 *
 * Never longer than 420ms — calm-luxury, not theatrical.
 */

export const duration = {
  instant: 0,
  micro: 180,
  standard: 280,
  hero: 420,
} as const;
export type Duration = keyof typeof duration;

/**
 * Bezier curves — express in the consumer's animation API. These are
 * cubic-bezier control points (x1, y1, x2, y2).
 */
export const easing = {
  emphasized: [0.2, 0, 0, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  decelerate: [0, 0, 0.2, 1] as const,
  accelerate: [0.4, 0, 1, 1] as const,
} as const;
export type Easing = keyof typeof easing;

/** Spring presets for Reanimated `withSpring`. */
export const spring = {
  /** Sheets, capture submit, modals. Soft and reassuring. */
  soft: { damping: 18, stiffness: 180, mass: 0.9 },
  /** Toggles, chip selections, snappy feedback. */
  snappy: { damping: 22, stiffness: 320, mass: 0.8 },
  /** Pull-to-refresh release, gentle pop. */
  bouncy: { damping: 12, stiffness: 220, mass: 1.0 },
} as const;
export type Spring = keyof typeof spring;

/** Stagger delay between sibling items (lists, chip rows). */
export const stagger = { tight: 30, base: 50, loose: 80 } as const;
export type Stagger = keyof typeof stagger;
