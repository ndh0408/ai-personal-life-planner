/**
 * Editorial Calm — warm, magazine-quiet dark palette.
 * Light theme will land in a later round; structurally the palette already
 * supports it (see theme/index.ts where we will swap surfaces).
 */
export const colors = {
  canvas: '#0B0B0F',
  surface: '#15151B',
  surfaceAlt: '#1F1F27',
  surfaceLifted: '#262631',
  border: '#252530',
  borderStrong: '#3A3A48',

  text: {
    primary: '#F4EFE7',
    secondary: '#9C968B',
    muted: '#6B6760',
    inverse: '#0B0B0F',
  },

  accent: {
    base: '#C97B4A',
    pressed: '#B86A3C',
    soft: 'rgba(201, 123, 74, 0.16)',
  },

  status: {
    success: '#7FA66B',
    warning: '#D6A24E',
    danger: '#C9624A',
    info: '#6B8FA8',
  },

  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export type Color = typeof colors;
