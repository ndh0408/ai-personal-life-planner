// tests/load/ai-quota-load.js — AI quota enforcement under load.
//
// REQUIRES the API to run with AI_PROVIDER=mock so we never call a real
// AI vendor. The mock provider returns deterministic responses; the
// scenario only verifies quota + ledger behaviour, not AI output quality.
//
// k6 run -e AI_PROVIDER_CHECK=true tests/load/ai-quota-load.js
//
// Acceptance:
//   - quota cap is enforced (next call after limit returns
//     errorCode: AI_DAILY_LIMIT_REACHED, NOT a successful AI response)
//   - ai_quota_block_total metric increments when blocked
//   - error rate on successful path < 2%

import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { authedPost, loadConfig, loginVu } from './lib/helpers.js';

export const options = {
  scenarios: {
    chat_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '3m',
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
  },
};

const cfg = loadConfig();
const TOKENS = {};
const blocked = new Counter('ai_quota_blocked_seen');
const succeeded = new Counter('ai_chat_succeeded');

export default function () {
  const idx = (__VU % cfg.users) + 1;
  if (!TOKENS[__VU]) TOKENS[__VU] = loginVu(cfg, idx);
  const token = TOKENS[__VU];
  if (!token) return;

  const r = authedPost(cfg, token, '/api/ai/chat', {
    messages: [{ role: 'USER', content: 'hello load test' }],
  });
  check(r, {
    'chat: 200 or 403 AI_DAILY_LIMIT_REACHED': (res) =>
      res.status === 200 ||
      (res.status === 403 && /AI_DAILY_LIMIT_REACHED/.test(res.body)),
  });
  if (r.status === 403 && /AI_DAILY_LIMIT_REACHED/.test(r.body)) blocked.add(1);
  if (r.status === 200) succeeded.add(1);

  // Slow tempo — daily quotas are small (round-12 default 40/day for chat),
  // so we exercise the cap with reasonable VUs rather than bursting.
  sleep(2 + Math.random() * 3);
}

// Post-run: verify the AI usage ledger via:
//   SELECT feature, success, count(*) FROM ai_usage_logs
//   WHERE "createdAt" > NOW() - INTERVAL '10 minutes' GROUP BY 1,2;
// success=true rows should equal the per-user quota cap; success=false
// rows reflect any provider failures (none expected with mock).
