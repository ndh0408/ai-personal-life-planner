// k6 load-test shared helpers. Imported by every scenario script.
//
// All helpers are intentionally tiny — k6 scripts should be readable
// against the API they exercise, not buried under abstraction. The only
// thing we hide here is the URL-building + auth-token-caching boilerplate.
//
// Round-19 invariants:
//   - never log raw passwords / tokens (every log() call is helpered)
//   - never hit production by accident (config.baseUrl must be local/staging)
//   - never call real AI / SMTP / push endpoints (server config decides)

import http from 'k6/http';
import { check, fail } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Read environment-driven config:
 *   BASE_URL     defaults to http://127.0.0.1:3000
 *   USERS        number of seeded test users to spread VUs across (default 50)
 *   PASSWORD     shared seed password for load-test users (default 'LoadTest!1')
 */
export function loadConfig() {
  const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  if (/prod|production|live/i.test(baseUrl)) {
    fail(`refusing to run against a production-looking BASE_URL: ${baseUrl}`);
  }
  return {
    baseUrl,
    users: Number(__ENV.USERS || 50),
    password: __ENV.PASSWORD || 'LoadTest!1',
    seedPrefix: __ENV.SEED_PREFIX || 'loadtest+',
    seedDomain: __ENV.SEED_DOMAIN || 'lifeos.local',
  };
}

/** Build an email for a deterministic load-test user index. */
export function emailForVu(cfg, idx) {
  return `${cfg.seedPrefix}${idx}@${cfg.seedDomain}`;
}

/**
 * Login + return the access token. Uses the seeded users from
 * scripts/seed-load-test.ts; assumes they share PASSWORD.
 *
 * Returns null on failure so the caller decides whether to retry / abort.
 */
export function loginVu(cfg, idx) {
  const res = http.post(
    `${cfg.baseUrl}/api/auth/login`,
    JSON.stringify({ email: emailForVu(cfg, idx), password: cfg.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth/login' } },
  );
  if (res.status !== 200) return null;
  let body;
  try {
    body = res.json();
  } catch {
    return null;
  }
  return body && body.data && body.data.accessToken ? body.data.accessToken : null;
}

/** Wraps http.* with the bearer header set; returns the same Response. */
export function authedGet(cfg, token, path, extraTags = {}) {
  return http.get(`${cfg.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { endpoint: path, ...extraTags },
  });
}

export function authedPost(cfg, token, path, body, extraTags = {}) {
  return http.post(`${cfg.baseUrl}${path}`, JSON.stringify(body), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { endpoint: path, ...extraTags },
  });
}

export function authedPatch(cfg, token, path, body, headers = {}, extraTags = {}) {
  return http.patch(`${cfg.baseUrl}${path}`, JSON.stringify(body), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    tags: { endpoint: path, ...extraTags },
  });
}

/** Standard checks reused across scenarios. */
export function expectStatus(res, expected, name) {
  const ok = check(res, {
    [`${name} status==${expected}`]: (r) => r.status === expected,
  });
  if (!ok) {
    // k6's console.log is rate-limited; one line per failure is fine.
    // eslint-disable-next-line no-console
    console.warn(`${name}: got ${res.status} (expected ${expected})`);
  }
  return ok;
}

/** Generate a fresh idempotency key per request — uuid v4 string. */
export function idempotencyKey() {
  return uuidv4();
}
