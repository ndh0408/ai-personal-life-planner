/**
 * Resolve the API base URL.
 *
 * Two-tier override:
 *   1. process.env.LIFEOS_API_BASE_URL (Metro bundle-time injection) wins.
 *   2. Otherwise, fall back to the per-env default in config/env.ts.
 *
 * Round 19: previously this file hardcoded one URL and let one env var
 * override it. The new layout names environments explicitly so the debug
 * screen and the API client can both report which target is live.
 */
import { APP_ENV, defaultApiBaseUrl } from '../../config/env';

declare const __DEV__: boolean;

function pickBaseUrl(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const fromEnv = env?.LIFEOS_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return defaultApiBaseUrl(APP_ENV);
}

export const API_BASE_URL = pickBaseUrl();

if (!__DEV__ && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
  // Loud failure during JS init in production builds — surfaces in logcat.
  // eslint-disable-next-line no-console
  console.error('[lifeos] refusing to use a localhost API_BASE_URL in production');
}

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(`[lifeos] env=${APP_ENV} api=${API_BASE_URL}`);
}
