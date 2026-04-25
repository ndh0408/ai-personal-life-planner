// tests/load/smoke.js — register/login + walk the must-work endpoints once.
//
// k6 run tests/load/smoke.js
// Every scenario in this directory should pass smoke first.
//
// Thresholds intentionally STRICT — smoke is a single-VU walk-through, so
// any failure here means the API is broken or the seed didn't run.

import { sleep } from 'k6';
import { authedGet, authedPost, expectStatus, loadConfig, loginVu } from './lib/helpers.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

const cfg = loadConfig();

export default function () {
  // 1. Login as the first seeded user.
  const token = loginVu(cfg, 1);
  if (!token) {
    expectStatus({ status: 0 }, 200, 'login');
    return;
  }

  // 2. /me
  const me = authedGet(cfg, token, '/api/users/me');
  expectStatus(me, 200, 'GET /me');

  // 3. /dashboard/summary
  const today = new Date().toISOString().slice(0, 10);
  const dash = authedGet(cfg, token, `/api/dashboard/summary?date=${today}`);
  expectStatus(dash, 200, 'GET /dashboard/summary');

  // 4. Create task
  const task = authedPost(cfg, token, '/api/tasks', {
    title: 'load-smoke task',
    priority: 'MEDIUM',
  });
  expectStatus(task, 201, 'POST /tasks');

  // 5. Create expense (needs a wallet; the seed grants one)
  const expense = authedPost(cfg, token, '/api/expenses', {
    title: 'smoke',
    amount: 1000,
    category: 'food',
    expenseDate: today,
  });
  expectStatus(expense, 201, 'POST /expenses');

  // 6. Recommendations
  const recs = authedGet(cfg, token, '/api/assistant/recommendations');
  expectStatus(recs, 200, 'GET /assistant/recommendations');

  // 7. Logout
  const out = authedPost(cfg, token, '/api/auth/logout', {});
  expectStatus(out, 204, 'POST /auth/logout');

  sleep(0.5);
}
