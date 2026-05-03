import { Platform, Vibration } from 'react-native';

/**
 * Haptics token map. Reanimated and gesture handlers fire these by name —
 * never call Vibration directly. Adding a new pattern here means one PR
 * touches one file; everywhere else just calls `haptic('selection')`.
 *
 * Round 40: this is the platform-neutral fallback using only RN built-ins.
 * Round 41 will swap in `expo-haptics` (iOS Taptic) + Android VibrationEffect
 * for the proper feel; the call sites stay identical.
 */

export type HapticToken =
  | 'selection'    // chip toggle, picker tick
  | 'soft'         // long-press start, focus
  | 'confirm'      // capture submit, save
  | 'success'      // positive completion
  | 'warning'      // pre-action confirmation needed
  | 'error';       // rejected, validation failed

/**
 * Vibration is a coarse approximation of haptic feedback — Android phones
 * vary, iOS simulator is silent. The patterns here are tuned to feel "right
 * enough" for development; production should replace with the native
 * implementation (see Round 41 plan above).
 */
const PATTERN: Record<HapticToken, number | number[]> = {
  selection: 8,
  soft: 12,
  confirm: 18,
  success: [0, 14, 30, 14],
  warning: [0, 22],
  error: [0, 30, 50, 30],
};

export function haptic(token: HapticToken): void {
  // iOS simulator and some Android devices ignore Vibration; that's fine —
  // a missing buzz never breaks UX. Wrap in try/catch only because some old
  // Android ROMs throw on missing VIBRATE permission rather than no-op.
  try {
    if (Platform.OS === 'web') return;
    const pattern = PATTERN[token];
    if (typeof pattern === 'number') Vibration.vibrate(pattern);
    else Vibration.vibrate(pattern);
  } catch {
    // swallow — haptics are decorative, not load-bearing
  }
}
