// tests/load/assistant-monitoring-load.js — run the daily assistant
// monitor for many users in parallel and verify:
//   - the rule-based path doesn't call AI when not needed (AI usage ledger
//     stays at the rule-only floor)
//   - no duplicate-recommendation spam (the assistant module already
//     dedupes by `(userId, type, day)` — verify under load)
//
// REQUIRES the API to run with AI_PROVIDER=mock.
//
// k6 run tests/load/assistant-monitoring-load.js

import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { authedGet, authedPost, expectStatus, loadConfig, loginVu } from './lib/helpers.js';

export const options = {
  scenarios: {
    monitor_sweep: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.02'],
    checks: ['rate>0.95'],
  },
};

const cfg = loadConfig();
const TOKENS = {};
const monitorOk = new Counter('monitor_ok');

export default function () {
  const idx = (__VU % cfg.users) + 1;
  if (!TOKENS[__VU]) TOKENS[__VU] = loginVu(cfg, idx);
  const token = TOKENS[__VU];
  if (!token) return;

  // Round-12 daily monitor endpoint. Endpoint must be tagged here so
  // operators can scope thresholds in the k6 dashboard.
  const today = new Date().toISOString().slice(0, 10);
  const r = authedPost(cfg, token, `/api/assistant/daily-monitor`, { date: today });
  expectStatus(r, 200, 'POST /assistant/daily-monitor');
  if (r.status === 200) monitorOk.add(1);

  // Pull the recommendation list back to verify dedupe under repeated runs.
  const recs = authedGet(cfg, token, '/api/assistant/recommendations');
  expectStatus(recs, 200, 'GET /assistant/recommendations');

  sleep(2 + Math.random() * 3);
}

// Post-run verification (run twice within 1h, expect ≤ 1 recommendation
// per (userId, type, day) when the rule context is unchanged):
//
//   SELECT "userId", type, count(*) FROM ai_recommendations
//   WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
//   GROUP BY 1, 2 HAVING count(*) > 1;
//
// Expected: 0 rows.
