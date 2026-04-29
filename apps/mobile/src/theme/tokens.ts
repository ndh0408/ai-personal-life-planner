/**
 * Semantic design tokens (round 31).
 *
 * The existing `colors` object names raw palette values
 * (`colors.expense.base`). That's served us well for surfaces dedicated
 * to one domain, but the redesigned Home / Assistant / SmartEntry need
 * a flatter, role-based vocabulary so a component doesn't have to know
 * "the panel of finance is sienna" to look right.
 *
 * Tokens here:
 *   - `bg.*` for backgrounds in increasing visual weight.
 *   - `text.*` for foreground roles.
 *   - `border.*` for hairlines + emphasized edges.
 *   - `accent` and `accentSoft` for the brand sienna.
 *   - `tone.*` for status states (success / warning / danger / info / ai)
 *     each as { fg, bg } so a component renders an icon + chip without
 *     juggling four imports.
 *   - `kind.*` for capture kinds (expense / income / task / meal / sleep
 *     / mood / unknown) — used by KindBadge etc.
 *
 * Existing `colors` is still exported (deprecation by attrition); new
 * components should import `tokens` instead.
 */
import { colors } from './colors';

export const tokens = {
  bg: {
    canvas: colors.canvas,
    surface: colors.surface,
    panel: colors.surfaceAlt,
    lifted: colors.surfaceLifted,
    overlay: colors.overlay,
  },
  text: {
    primary: colors.text.primary,
    secondary: colors.text.secondary,
    muted: colors.text.muted,
    inverse: colors.text.inverse,
    accent: colors.accent.base,
  },
  border: {
    subtle: colors.border,
    strong: colors.borderStrong,
    accent: colors.accent.base,
  },
  accent: colors.accent.base,
  accentPressed: colors.accent.pressed,
  accentSoft: colors.accent.soft,

  /**
   * Status / tone roles. `bg` is a translucent fill suitable as chip /
   * banner background. `fg` is the corresponding ink — readable against
   * either `bg` (for filled chips) or the canvas (for icons + labels).
   */
  tone: {
    success: { fg: colors.status.success, bg: 'rgba(127, 166, 107, 0.18)' },
    warning: { fg: colors.status.warning, bg: 'rgba(214, 162, 78, 0.18)' },
    danger: { fg: colors.status.danger, bg: 'rgba(201, 98, 74, 0.18)' },
    info: { fg: colors.status.info, bg: 'rgba(107, 143, 168, 0.18)' },
    /** AI badge tone — sienna accent. */
    ai: { fg: colors.accent.base, bg: colors.accent.soft },
    neutral: { fg: colors.text.secondary, bg: colors.surfaceAlt },
  },

  /** Capture-kind palette. KindBadge + alternative chips read these. */
  kind: {
    EXPENSE: { fg: colors.expense.base, bg: colors.expense.soft },
    INCOME: { fg: colors.income.base, bg: colors.income.soft },
    TASK: { fg: colors.status.info, bg: 'rgba(107, 143, 168, 0.18)' },
    MEAL: { fg: colors.status.success, bg: 'rgba(127, 166, 107, 0.18)' },
    SLEEP: { fg: '#9085C7', bg: 'rgba(107, 89, 168, 0.18)' },
    MOOD: { fg: colors.status.warning, bg: 'rgba(214, 162, 78, 0.18)' },
    UNKNOWN: { fg: colors.text.muted, bg: colors.surfaceAlt },
  },

  /**
   * Touch target floor — Material guidance is 48dp, iOS HIG is 44pt;
   * 44 covers both since RN dp ~= iOS pt.
   */
  hitSize: 44,
} as const;

export type Tokens = typeof tokens;
export type ToneName = keyof Tokens['tone'];
export type KindName = keyof Tokens['kind'];
