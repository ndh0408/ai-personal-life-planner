/**
 * App environment selector.
 *
 * Until round 19 the mobile app had exactly one base URL hardcoded in
 * services/api/config.ts. That was fine for a single-target deployment but
 * it made it dangerously easy to point a debug build at the production API
 * by mistake — and there was no way to tell from the running app which
 * backend it had connected to.
 *
 * The selector reads `process.env.LIFEOS_ENV` at Metro bundle time. Set it
 * via `LIFEOS_ENV=staging npm run android` or in the gradle build flavour.
 * Defaults to `prod` on release builds and `dev` on debug, so accidental
 * misconfiguration fails closed (you'll hit the dev/staging API, not prod).
 */

declare const __DEV__: boolean;

export type AppEnv = 'dev' | 'staging' | 'prod';

const VALID: AppEnv[] = ['dev', 'staging', 'prod'];

function readEnvVar(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.LIFEOS_ENV;
}

function pickEnv(): AppEnv {
  const raw = readEnvVar();
  if (raw && (VALID as string[]).includes(raw)) return raw as AppEnv;
  // Default by build flavour: __DEV__ === true on Metro/debug builds.
  return __DEV__ ? 'dev' : 'prod';
}

export const APP_ENV: AppEnv = pickEnv();

/**
 * Per-environment defaults. The public Cloudflare Tunnel
 * (api.tothanhthuy.cloud → 127.0.0.1:4000 on huy-server) terminates HTTPS
 * at Cloudflare's edge, so phones can reach the API from any network —
 * not just the dev tailnet. Override the URL at bundle time with
 * LIFEOS_API_BASE_URL when running against a different ingress.
 */
const API_BY_ENV: Record<AppEnv, string> = {
  dev: 'https://api.tothanhthuy.cloud/api',
  staging: 'https://api.tothanhthuy.cloud/api',
  prod: 'https://api.tothanhthuy.cloud/api',
};

export function defaultApiBaseUrl(env: AppEnv = APP_ENV): string {
  return API_BY_ENV[env];
}
