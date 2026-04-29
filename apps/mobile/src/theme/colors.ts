/**
 * Editorial Calm — warm, magazine-quiet dark palette.
 * Round-17 polish: lifted surface for cards, dedicated income/expense tones,
 * gradient stops for hero + sparkline.
 */
export const colors = {
  canvas: '#0A0A10',
  surface: '#15151D',
  surfaceAlt: '#1F1F2A',
  surfaceLifted: '#262635',
  border: '#252533',
  borderStrong: '#3A3A48',

  text: {
    primary: '#F4EFE7',
    secondary: '#A8A299',
    muted: '#6B6760',
    inverse: '#0B0B0F',
  },

  accent: {
    base: '#D08A5C',
    pressed: '#B86A3C',
    soft: 'rgba(208, 138, 92, 0.16)',
    softer: 'rgba(208, 138, 92, 0.08)',
  },

  // Money direction palette — INCOME = warm green-cream, EXPENSE = clay red.
  income: {
    base: '#7FA66B',
    soft: 'rgba(127, 166, 107, 0.18)',
  },
  expense: {
    base: '#C9624A',
    soft: 'rgba(201, 98, 74, 0.18)',
  },

  status: {
    success: '#7FA66B',
    warning: '#D6A24E',
    danger: '#C9624A',
    info: '#6B8FA8',
  },

  // Subtle gradients used by hero + cards.
  gradient: {
    heroFrom: '#1A1622',
    heroTo: '#0F0F18',
    incomeFrom: 'rgba(127, 166, 107, 0.22)',
    incomeTo: 'rgba(127, 166, 107, 0.04)',
    expenseFrom: 'rgba(201, 98, 74, 0.22)',
    expenseTo: 'rgba(201, 98, 74, 0.04)',
  },

  overlay: 'rgba(0, 0, 0, 0.62)',
} as const;

export type Color = typeof colors;
