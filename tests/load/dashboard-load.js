// tests/load/dashboard-load.js — read-heavy dashboard summary + recommendations.
//
// k6 run tests/load/dashboard-load.js
//
// Acceptance:
//   - p95 GET /dashboard/summary < 800 ms
//   - p95 GET /assistant/recommendations < 500 ms
//   - error rate < 1%

import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { authedGet, expectStatus, loadConfig, loginVu } from './lib/helpers.js';

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '3m', target: 80 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{endpoint:/api/dashboard/summary}': ['p(95)<800', 'p(99)<2000'],
    'http_req_duration{endpoint:/api/assistant/recommendations}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const cfg = loadConfig();
const dashLatency = new Trend('dashboard_summary_ms');

// Token cache — login once per VU, reuse across iterations to avoid
// thrashing the auth path.
const TOKENS = {};

export default function () {
  const idx = (__VU % cfg.users) + 1;
  if (!TOKENS[__VU]) {
    TOKENS[__VU] = loginVu(cfg, idx);
    if (!TOKENS[__VU]) {
      expectStatus({ status: 0 }, 200, 'login');
      return;
    }
  }
  const token = TOKENS[__VU];

  const today = new Date().toISOString().slice(0, 10);
  const dash = authedGet(cfg, token, `/api/dashboard/summary?date=${today}`);
  dashLatency.add(dash.timings.duration);
  expectStatus(dash, 200, 'GET /dashboard/summary');

  const recs = authedGet(cfg, token, '/api/assistant/recommendations');
  expectStatus(recs, 200, 'GET /assistant/recommendations');

  sleep(Math.random() * 2);
}
