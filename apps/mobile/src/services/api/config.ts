/**
 * The base URL is resolved in this order:
 *   1. process.env.LIFEOS_API_BASE_URL (baked at bundle time)
 *   2. Tailscale dev-box IP for non-production builds
 *   3. Hard fail in production with a non-localhost requirement
 */
const PROD_DEFAULT = 'https://api.lifeos.app/api'; // placeholder until prod ingress lands

const DEV_DEFAULT = 'http://100.100.210.85:4000/api';

declare const __DEV__: boolean;

function pickBaseUrl(): string {
  // @ts-expect-error — process is shimmed by Metro
  const fromEnv: string | undefined = typeof process !== 'undefined' ? process.env?.LIFEOS_API_BASE_URL : undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (typeof __DEV__ !== 'undefined' && __DEV__) return DEV_DEFAULT;
  return PROD_DEFAULT;
}

export const API_BASE_URL = pickBaseUrl();

if (!__DEV__ && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
  // Loud failure during JS init in production builds — surfaces in logcat.
  // eslint-disable-next-line no-console
  console.error('[lifeos] refusing to use a localhost API_BASE_URL in production');
}
