/**
 * Responsive layout primitive used across the app.
 *
 * Drives:
 *  - Horizontal padding (snug on small phones, generous on tablets)
 *  - Content max-width (caps card widths on tablets / landscape)
 *  - Device class (smallPhone / phone / largePhone / tablet) for one-off branches
 *  - Orientation
 *  - Font scale awareness (so we can clip hero text on huge accessibility settings)
 *
 * Breakpoints chosen for the most common Android + iOS form factors as of 2026:
 *   < 360 dp width       → smallPhone   (iPhone SE 1st gen, very old Androids)
 *   360 – 411 dp         → phone        (most mid-range Androids, iPhone 12/13)
 *   412 – 599 dp         → largePhone   (Pixel 6/7 Pro, Samsung S22 Ultra, iPhone 14 Plus)
 *   ≥ 600 dp             → tablet       (foldable inner display, iPad mini, Android tablets)
 *
 * Heuristic, not pixel-perfect — the goal is to avoid hardcoded sizes, not
 * to ship a CSS-grade responsive engine.
 */
import { PixelRatio, useWindowDimensions } from 'react-native';

export type DeviceClass = 'smallPhone' | 'phone' | 'largePhone' | 'tablet';
export type Orientation = 'portrait' | 'landscape';

export interface ResponsiveInfo {
  width: number;
  height: number;
  device: DeviceClass;
  orientation: Orientation;
  /** Max horizontal column width content should occupy. Below this, content is edge-to-edge. */
  contentMaxWidth: number;
  /** Default horizontal screen padding (added on top of the max-width centring). */
  horizontalPadding: number;
  /** Number of grid columns sensible for card layouts. */
  columns: number;
  /** OS / accessibility font scale (capped at 1.6 for layout safety). */
  fontScale: number;
  /** True when Dynamic Type / system font scale is significantly above 1. */
  isLargeFont: boolean;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height, fontScale: rawFontScale } = useWindowDimensions();
  const orientation: Orientation = width >= height ? 'landscape' : 'portrait';

  // Use the *short* edge for device classification — landscape phones are
  // still phones, not tablets, even though their width is huge.
  const shortEdge = Math.min(width, height);

  let device: DeviceClass;
  if (shortEdge < 360) device = 'smallPhone';
  else if (shortEdge < 412) device = 'phone';
  else if (shortEdge < 600) device = 'largePhone';
  else device = 'tablet';

  // Padding: tighter on small phones, more breathing room on tablets.
  const horizontalPadding =
    device === 'smallPhone' ? 16 : device === 'tablet' ? 32 : 24;

  // Column cap: phones go full-bleed; tablets cap at ~640dp readable width
  // (matches common iPad reading zone).
  const contentMaxWidth =
    device === 'tablet' ? 640 : device === 'largePhone' ? Math.min(width, 520) : width;

  // Card grid columns: 1 on phones, 2 on tablets in landscape.
  let columns = 1;
  if (device === 'tablet' && orientation === 'landscape') columns = 2;

  const fontScale = Math.min(rawFontScale ?? PixelRatio.getFontScale(), 1.6);
  const isLargeFont = fontScale > 1.15;

  return {
    width,
    height,
    device,
    orientation,
    contentMaxWidth,
    horizontalPadding,
    columns,
    fontScale,
    isLargeFont,
  };
}

/**
 * Picks the right value per device class. Useful for inline style props:
 *   const margin = pickByDevice(info.device, { smallPhone: 8, phone: 12, tablet: 24 });
 */
export function pickByDevice<T>(
  device: DeviceClass,
  values: Partial<Record<DeviceClass, T>> & { phone: T },
): T {
  return values[device] ?? values.phone;
}
