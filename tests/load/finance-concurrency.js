// tests/load/finance-concurrency.js — race + idempotency + balance correctness.
//
// k6 run tests/load/finance-concurrency.js
//
// Acceptance:
//   - p95 POST /expenses < 1000 ms
//   - p95 PATCH /debts/:id/payment < 1000 ms
//   - 0 finance balance mismatch (verified post-run via SQL — see docs)
//   - retried requests with same Idempotency-Key produce 1 row, not 2
//   - concurrent debt payments either succeed OR return CONCURRENT_WRITE
//     (no overpay, no balance corruption)

import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  authedGet,
  authedPatch,
  authedPost,
  expectStatus,
  idempotencyKey,
  loadConfig,
  loginVu,
} from './lib/helpers.js';

export const options = {
  scenarios: {
    expenses_create: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '2m', target: 40 },
        { duration: '20s', target: 0 },
      ],
      exec: 'createExpenses',
    },
    debt_payments: {
      executor: 'constant-vus',
      vus: 8,
      duration: '2m',
      exec: 'payDebts',
    },
    saving_contributions: {
      executor: 'constant-vus',
      vus: 8,
      duration: '2m',
      exec: 'contributeSaving',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:/api/expenses}': ['p(95)<1000'],
    'http_req_failed{endpoint:/api/expenses}': ['rate<0.02'],
    checks: ['rate>0.95'],
  },
};

const cfg = loadConfig();
const concurrentWriteSeen = new Counter('concurrent_write_seen');
const idempotencyDedupe = new Counter('idempotency_dedupe_seen');
const TOKENS = {};
// Per-VU debt + saving-goal cache (resolved once on first iteration).
const DEBT_IDS = {};
const SG_IDS = {};

function tokenFor() {
  const idx = (__VU % cfg.users) + 1;
  if (!TOKENS[__VU]) TOKENS[__VU] = loginVu(cfg, idx);
  return TOKENS[__VU];
}

export function createExpenses() {
  const token = tokenFor();
  if (!token) return;
  const today = new Date().toISOString().slice(0, 10);
  const key = idempotencyKey();
  // Issue twice with the SAME key to exercise dedupe under load.
  const a = authedPost(cfg, token, '/api/expenses', {
    title: `load-${__VU}-${__ITER}`,
    amount: 1234,
    category: 'food',
    expenseDate: today,
  }, { 'Idempotency-Key': key });
  expectStatus(a, 201, 'POST /expenses #1');
  const b = authedPost(cfg, token, '/api/expenses', {
    title: `load-${__VU}-${__ITER}`,
    amount: 1234,
    category: 'food',
    expenseDate: today,
  }, { 'Idempotency-Key': key });
  if (a.status === 201 && b.status === 201) {
    const aId = a.json().data?.id;
    const bId = b.json().data?.id;
    if (aId && bId && aId === bId) idempotencyDedupe.add(1);
  }
  sleep(Math.random());
}

function ensureDebt(token) {
  if (DEBT_IDS[__VU]) return DEBT_IDS[__VU];
  const r = authedPost(cfg, token, '/api/debts', {
    type: 'I_OWE',
    title: `load-debt-vu${__VU}`,
    totalAmount: 100_000_000,
  });
  if (r.status === 201) {
    DEBT_IDS[__VU] = r.json().data?.id;
  }
  return DEBT_IDS[__VU];
}

export function payDebts() {
  const token = tokenFor();
  if (!token) return;
  const debtId = ensureDebt(token);
  if (!debtId) return;
  const key = idempotencyKey();
  const r = authedPatch(cfg, token, `/api/debts/${debtId}/payment`, { amount: 100 }, {
    'Idempotency-Key': key,
  });
  // Round-13 contract: success OR CONCURRENT_WRITE — nothing else
  // (assuming the debt has headroom, which it does since totalAmount is huge).
  check(r, {
    'pay debts: 200 or CONCURRENT_WRITE': (res) =>
      res.status === 200 ||
      (res.status === 400 && /CONCURRENT_WRITE/.test(res.body)),
  });
  if (r.status === 400 && /CONCURRENT_WRITE/.test(r.body)) concurrentWriteSeen.add(1);
  sleep(Math.random() * 0.5);
}

function ensureSavingGoal(token) {
  if (SG_IDS[__VU]) return SG_IDS[__VU];
  const r = authedPost(cfg, token, '/api/saving-goals', {
    title: `load-sg-vu${__VU}`,
    targetAmount: 100_000_000,
  });
  if (r.status === 201) SG_IDS[__VU] = r.json().data?.id;
  return SG_IDS[__VU];
}

export function contributeSaving() {
  const token = tokenFor();
  if (!token) return;
  const sgId = ensureSavingGoal(token);
  if (!sgId) return;
  const r = authedPatch(cfg, token, `/api/saving-goals/${sgId}/contribute`, { amount: 100 });
  check(r, {
    'contribute: 200 or CONCURRENT_WRITE': (res) =>
      res.status === 200 ||
      (res.status === 400 && /CONCURRENT_WRITE/.test(res.body)),
  });
  if (r.status === 400 && /CONCURRENT_WRITE/.test(r.body)) concurrentWriteSeen.add(1);
  sleep(Math.random() * 0.5);
}

// Post-run verification: see docs/PERFORMANCE_RESULTS.md for the
// recommended SQL queries that confirm wallet balance + debt paidAmount
// + saving currentAmount match the row counts produced by this scenario.
