# Load Testing — LifeOS AI

Round-19 ships the load-testing **harness**: 8 k6 scenarios, a seed +
cleanup pair for synthetic users, and the operator's playbook. We did NOT
run a 2-hour soak in this round — that's the operator's responsibility on
their staging cluster. `docs/PERFORMANCE_RESULTS.md` is the template for
recording the run.

## Tooling

- [k6](https://k6.io/) (chosen over Artillery: built-in JS scenarios,
  arrival-rate executor, low overhead per VU, single binary).
- One shared helper module at `tests/load/lib/helpers.js`. No DSL.

Install k6:
```bash
# macOS
brew install k6
# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Scenarios

| Script | Duration | What it covers |
|--|--|--|
| `tests/load/smoke.js` | < 30 s | Single VU walk-through of register/login/dashboard/task/expense/recs/logout |
| `tests/load/auth-load.js` | ~3 min | Login success + wrong-password + refresh + lockout + rate limit |
| `tests/load/dashboard-load.js` | ~4 min | GET /dashboard/summary + recommendations under read-heavy load |
| `tests/load/finance-concurrency.js` | ~3 min | Concurrent expenses + debt payments + saving contributions; idempotency dedupe |
| `tests/load/ai-quota-load.js` | ~3 min | AI quota enforcement (mock provider) |
| `tests/load/notification-queue-load.js` | ~3 min | Notification dispatcher under burst |
| `tests/load/assistant-monitoring-load.js` | ~2 min | Daily monitor sweep — dedupe + no AI spam |
| `tests/load/soak-2h.js` | **2 h** | Mixed traffic + memory/CPU/latency-trend capture |

Every script honours `BASE_URL`, `USERS`, `PASSWORD` env. Helper refuses
to run against URLs containing `prod|production|live` — guard against an
operator pasting the wrong target.

## Required server config (load-test environment)

The harness needs the API to fake out external systems so we never page
real providers:

```bash
# In .env.staging (or container env):
NODE_ENV=production              # so env validation behaves like prod
AI_PROVIDER=mock                 # never call Anthropic/OpenAI
EXPO_PUSH_DRY_RUN=true           # dispatcher logs but never POSTs to Expo
EMAIL_PROVIDER=console           # no real email
QUEUE_ENABLED=true               # exercise the real queue path
METRICS_ENABLED=true
METRICS_BEARER_TOKEN=<long random>
```

The seed users get elevated AI quotas (chat=100/day, schedule=50/day) so
quota-load can drive the cap without immediately exhausting every user.

## Operator playbook

```bash
# 1. Seed N synthetic users.
cd apps/api && npx ts-node ../../scripts/seed-load-test.ts \
  --count 200 --password "$LOADTEST_PASSWORD" \
  --prefix loadtest+ --domain lifeos-staging.local

# 2. Smoke-check first (single VU).
BASE_URL=https://api.staging.example.com USERS=200 \
PASSWORD="$LOADTEST_PASSWORD" \
  k6 run tests/load/smoke.js

# 3. Run each scenario, one at a time. Capture the JSON summary.
for s in auth-load dashboard-load finance-concurrency ai-quota-load \
         notification-queue-load assistant-monitoring-load; do
  BASE_URL=https://api.staging.example.com USERS=200 \
  PASSWORD="$LOADTEST_PASSWORD" \
    k6 run --summary-export "tests/load/results/${s}-$(date -u +%Y%m%d).json" \
    "tests/load/${s}.js"
done

# 4. Soak: schedule overnight + capture metrics every 5 min.
BASE_URL=https://api.staging.example.com USERS=200 \
PASSWORD="$LOADTEST_PASSWORD" \
  k6 run --summary-export "tests/load/results/soak-$(date -u +%Y%m%d).json" \
  tests/load/soak-2h.js &
( while true; do
    curl -fsS -H "Authorization: Bearer $METRICS_BEARER_TOKEN" \
      "${BASE_URL}/metrics" > "tests/load/results/metrics-$(date -u +%H%M).prom"
    sleep 300
  done ) &

# 5. Cleanup.
cd apps/api && npx ts-node ../../scripts/cleanup-load-test.ts \
  --prefix loadtest+ --domain lifeos-staging.local \
  --confirm I-AM-IN-STAGING
```

## What to capture (per run)

Drop into `docs/PERFORMANCE_RESULTS.md`:

- k6 summary JSON (auto-emitted by `--summary-export`)
- `/metrics` snapshot every 5 min during soak
- DB connection count: `SELECT count(*) FROM pg_stat_activity GROUP BY state;`
- Redis `INFO memory` + `BullMQ` queue depth
- Test machine specs (CPU model, RAM, network) — capacity numbers are
  meaningless without them
- API container resource limits + observed CPU/RAM

## Acceptance thresholds (defaults in each script)

| Scenario | Threshold | Why |
|--|--|--|
| Smoke | http_req_failed < 1%, p95 < 2s | Single-VU; any failure = broken |
| Auth | login p95 < 500 ms, error < 1% | Cheapest endpoint; sets the floor |
| Dashboard | summary p95 < 800 ms, p99 < 2 s | Heavy aggregator; round-13 finance fixed multi-currency |
| Finance | expenses p95 < 1 s, error < 2% | Decimal + transaction overhead |
| AI quota | error rate < 2% on success path | Quota refusal is a SUCCESS, not error |
| Notification | http_req_failed < 2% | Worker drains async; drain-time is post-run check |
| Assistant | http_req_failed < 2% | Rule-based path; AI calls dedupe |
| Soak | flat curves (no upward trend in p95/error/RAM) | Leak detection |

## Failures don't auto-fail the round

If a scenario doesn't meet its threshold:
1. **Don't** disable the threshold — that's how production accidents
   happen. Open `docs/incidents/YYYY-MM-DD-load-test-failure.md`.
2. Capture the bottleneck (DB, Redis, API CPU, network).
3. Update `docs/PERFORMANCE_RESULTS.md` with the actual numbers.
4. Adjust the readiness statement in `docs/FULL_PROJECT_COMPLETION_ENTERPRISE_AUDIT.md`
   based on real evidence — never claim a tier you haven't measured.

## What this round does NOT cover

- Mobile-app load (no synthetic-traffic harness inside React Native).
- TLS termination overhead (k6 runs against the API directly; if your
  Ingress does CPU-heavy TLS, measure separately).
- DB-only load tests (use `pgbench` or `pgreplay-go` separately).
- Chaos tests (kill -9 the API mid-load, partition Redis). Round-20
  candidate.
- Real-network latency between mobile clients in Vietnam and a US-region
  API. Add `k6 cloud` or run k6 from the same region as your users.
