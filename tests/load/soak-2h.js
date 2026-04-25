// tests/load/soak-2h.js — 2-hour soak with mixed traffic.
//
// k6 run tests/load/soak-2h.js
//
// Mixed-traffic profile (rates per second across the whole soak):
//   - 4 rps  GET /dashboard/summary
//   - 2 rps  GET /assistant/recommendations
//   - 1 rps  POST /tasks
//   - 0.5 rps POST /expenses (with Idempotency-Key)
//   - 0.2 rps POST /ai/chat (mock provider)
//
// What we're looking for:
//   - p95/p99 trending UP over time → memory leak / GC pressure
//   - error rate trending UP → connection-pool saturation, lock contention
//   - flat curve → healthy
//
// Capture from the metrics endpoint (round-12 /metrics) every 5 min:
//   curl -s -H "Authorization: Bearer $METRICS_BEARER_TOKEN" \
//     $BASE_URL/metrics > /tmp/lifeos-soak-$(date +%s).prom

import { sleep } from 'k6';
import {
  authedGet,
  authedPost,
  expectStatus,
  idempotencyKey,
  loadConfig,
  loginVu,
} from './lib/helpers.js';

export const options = {
  scenarios: {
    dashboard: {
      executor: 'constant-arrival-rate',
      rate: 4,
      timeUnit: '1s',
      duration: '2h',
      preAllocatedVUs: 20,
      maxVUs: 60,
      exec: 'dashboardRead',
    },
    assistant: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '2h',
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: 'assistantRead',
    },
    tasks: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '2h',
      preAllocatedVUs: 8,
      maxVUs: 20,
      exec: 'createTask',
    },
    expenses: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '2s', // 0.5/s
      duration: '2h',
      preAllocatedVUs: 8,
      maxVUs: 20,
      exec: 'createExpense',
    },
    ai_chat: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '5s', // 0.2/s
      duration: '2h',
      preAllocatedVUs: 4,
      maxVUs: 10,
      exec: 'aiChat',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:/api/dashboard/summary}': [
      'p(95)<800',
      'p(99)<2000',
    ],
    'http_req_duration{endpoint:/api/expenses}': ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

const cfg = loadConfig();
const TOKENS = {};

function tokenFor() {
  const idx = (__VU % cfg.users) + 1;
  if (!TOKENS[__VU]) TOKENS[__VU] = loginVu(cfg, idx);
  return TOKENS[__VU];
}

export function dashboardRead() {
  const token = tokenFor();
  if (!token) return;
  const today = new Date().toISOString().slice(0, 10);
  const r = authedGet(cfg, token, `/api/dashboard/summary?date=${today}`);
  expectStatus(r, 200, 'soak: dashboard');
}

export function assistantRead() {
  const token = tokenFor();
  if (!token) return;
  const r = authedGet(cfg, token, '/api/assistant/recommendations');
  expectStatus(r, 200, 'soak: recs');
}

export function createTask() {
  const token = tokenFor();
  if (!token) return;
  const r = authedPost(cfg, token, '/api/tasks', {
    title: `soak-${Date.now()}`,
    priority: 'LOW',
  });
  expectStatus(r, 201, 'soak: task');
}

export function createExpense() {
  const token = tokenFor();
  if (!token) return;
  const today = new Date().toISOString().slice(0, 10);
  const r = authedPost(cfg, token, '/api/expenses', {
    title: 'soak',
    amount: 100,
    category: 'misc',
    expenseDate: today,
  }, { 'Idempotency-Key': idempotencyKey() });
  expectStatus(r, 201, 'soak: expense');
}

export function aiChat() {
  const token = tokenFor();
  if (!token) return;
  const r = authedPost(cfg, token, '/api/ai/chat', {
    messages: [{ role: 'USER', content: 'soak' }],
  });
  // 200 OR 403 AI_DAILY_LIMIT_REACHED both acceptable — quota enforcement
  // is a successful outcome under load.
  if (r.status !== 200 && r.status !== 403) {
    expectStatus(r, 200, 'soak: ai chat');
  }
}
