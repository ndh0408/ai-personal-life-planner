/**
 * Elevation. Calm-luxury prefers stroke + bg shift over heavy shadows.
 * Reserve shadows for true overlays (sheets, modals, floating capture).
 */

export type ElevationToken = {
  /** iOS shadowOpacity. */
  iosOpacity: number;
  /** iOS shadowRadius. */
  iosRadius: number;
  /** iOS shadowOffsetY. */
  iosOffsetY: number;
  /** Android elevation dp. */
  androidElevation: number;
};

export const elevation: Record<string, ElevationToken> = {
  flat: { iosOpacity: 0, iosRadius: 0, iosOffsetY: 0, androidElevation: 0 },
  raised: { iosOpacity: 0.18, iosRadius: 6, iosOffsetY: 2, androidElevation: 2 },
  floating: { iosOpacity: 0.28, iosRadius: 24, iosOffsetY: 8, androidElevation: 12 },
  modal: { iosOpacity: 0.32, iosRadius: 32, iosOffsetY: 12, androidElevation: 16 },
};

export type ElevationLevel = keyof typeof elevation;
