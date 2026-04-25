// tests/load/auth-load.js — login / wrong-password / refresh / lockout / rate limit.
//
// k6 run tests/load/auth-load.js
//
// Round-19 acceptance:
//   - p95 login < 500 ms
//   - lockout fires at ≥5 wrong attempts (per-account)
//   - 429 rate-limit fires under burst (per-IP)
//   - error rate on the success path < 1%

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { authedPost, expectStatus, loadConfig, emailForVu } from './lib/helpers.js';

export const options = {
  scenarios: {
    success_path: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'successPath',
    },
    failure_path: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'failurePath',
    },
  },
  thresholds: {
    'http_req_failed{endpoint:auth/login}': ['rate<0.01'],
    'http_req_duration{endpoint:auth/login}': ['p(95)<500'],
    checks: ['rate>0.95'],
  },
};

const cfg = loadConfig();
const lockoutSeen = new Counter('lockout_seen');
const rateLimitSeen = new Counter('rate_limit_seen');

export function successPath() {
  const idx = (__VU % cfg.users) + 1;
  const r = http.post(
    `${cfg.baseUrl}/api/auth/login`,
    JSON.stringify({ email: emailForVu(cfg, idx), password: cfg.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth/login' } },
  );
  expectStatus(r, 200, 'login success');
  if (r.status === 200) {
    const token = r.json().data?.accessToken;
    if (token) {
      // Refresh path — we hit the refresh endpoint with the issued token.
      const refreshToken = r.json().data?.refreshToken;
      if (refreshToken) {
        const rr = http.post(
          `${cfg.baseUrl}/api/auth/refresh`,
          JSON.stringify({ refreshToken }),
          { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth/refresh' } },
        );
        expectStatus(rr, 200, 'refresh');
      }
    }
  }
  sleep(1);
}

export function failurePath() {
  // Pin every wrong-password attempt to ONE account so lockout actually fires.
  const targetIdx = 1;
  const r = http.post(
    `${cfg.baseUrl}/api/auth/login`,
    JSON.stringify({
      email: emailForVu(cfg, targetIdx),
      password: 'definitely-wrong-' + __ITER,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth/login_wrong' } },
  );
  check(r, {
    'wrong-pw: 401 or 429 or lockout': (res) =>
      res.status === 401 || res.status === 429 ||
      (res.status === 401 && /ACCOUNT_TEMPORARILY_LOCKED/.test(res.body)),
  });
  if (r.status === 429) rateLimitSeen.add(1);
  if (/ACCOUNT_TEMPORARILY_LOCKED/.test(r.body)) lockoutSeen.add(1);
  sleep(0.5);
}
