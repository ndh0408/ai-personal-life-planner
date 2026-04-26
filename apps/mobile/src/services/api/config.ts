/**
 * Default API base URL — public HTTPS via Cloudflare Tunnel, served by the
 * NestJS API on huy-server. No Tailscale dependency for the phone anymore.
 *
 * Override at bundle time with process.env.LIFEOS_API_BASE_URL when running
 * against a different ingress (staging, local LAN, …).
 */
const PUBLIC_DEFAULT = 'https://api.tothanhthuy.cloud/api';

declare const __DEV__: boolean;

function pickBaseUrl(): string {
  // Metro shims `process.env.X` at bundle time; the global `process` may or
  // may not be typed. Cast through globalThis to avoid pulling in @types/node.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const fromEnv = env?.LIFEOS_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return PUBLIC_DEFAULT;
}

export const API_BASE_URL = pickBaseUrl();

if (!__DEV__ && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
  // Loud failure during JS init in production builds — surfaces in logcat.
  // eslint-disable-next-line no-console
  console.error('[lifeos] refusing to use a localhost API_BASE_URL in production');
}
