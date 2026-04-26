import { NativeModules, Platform } from 'react-native';

/**
 * Resolved at build time — see android/app/build.gradle (BuildConfig.API_BASE_URL).
 * On Android we read it from the native BuildConfig if present, falling back to
 * the Tailscale dev box. iOS will follow the same pattern when it lands.
 */
const FALLBACK = 'http://100.100.210.85:4000/api';

function readBuildConfig(): string | null {
  // The bare RN template doesn't expose BuildConfig as a JS module by default;
  // we keep this hook so a later round can wire it via a tiny native module.
  // For now the env baked into JS at bundle time wins.
  return null;
}

export const API_BASE_URL: string =
  // @ts-expect-error — injected by Metro via @env or process.env if present
  (typeof process !== 'undefined' && process.env?.LIFEOS_API_BASE_URL) ||
  readBuildConfig() ||
  FALLBACK;

export const PLATFORM_TAG = `${Platform.OS}/${Platform.Version}`;

// Suppress unused-NativeModules warning — kept for future native bridge.
void NativeModules;
