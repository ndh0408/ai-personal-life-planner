# Performance Results — LifeOS AI

> **Status:** TEMPLATE. Round-19 shipped the load-testing **harness**, not
> the measured results. This document is meant to be filled in by the
> operator after a real staging run. Do NOT cite it as evidence of
> production capacity until it has been replaced by real numbers.

## How to use this template

1. Run the scenarios per `docs/LOAD_TESTING.md`.
2. Copy the k6 summary JSON output into the per-scenario tables below.
3. Compute the capacity estimate in §3 from the actual numbers, NOT from
   the round-11 audit's theoretical estimates.
4. Commit the filled-in version. Future readers should be able to tell at
   a glance whether the document reflects measurement or theory.

---

## 1. Test environment

| Field | Value |
|--|--|
| Date (UTC) | _e.g. 2026-05-15_ |
| Tester | _on-call name_ |
| Target | _e.g. https://api.staging.example.com_ |
| API replicas | _e.g. 2 × api on n1-standard-2_ |
| Worker replicas | _e.g. 1 worker per role_ |
| Postgres | _e.g. RDS db.t3.medium 4 vCPU / 4 GB_ |
| Redis | _e.g. ElastiCache cache.t3.micro_ |
| k6 host | _CPU model + RAM + region_ |
| Server config | `AI_PROVIDER=mock`, `EXPO_PUSH_DRY_RUN=true`, `QUEUE_ENABLED=true` |

## 2. Per-scenario results

### 2.1 Smoke

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| http_req_failed | < 1% | _TBD_ | _TBD_ |
| http_req_duration p95 | < 2000 ms | _TBD_ | _TBD_ |
| checks rate | > 99% | _TBD_ | _TBD_ |

### 2.2 Auth load

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| login p95 | < 500 ms | _TBD_ | _TBD_ |
| login error rate | < 1% | _TBD_ | _TBD_ |
| lockout_seen | > 0 | _TBD_ | _TBD_ |
| rate_limit_seen | > 0 | _TBD_ | _TBD_ |

### 2.3 Dashboard load

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| /dashboard/summary p95 | < 800 ms | _TBD_ | _TBD_ |
| /dashboard/summary p99 | < 2000 ms | _TBD_ | _TBD_ |
| /assistant/recommendations p95 | < 500 ms | _TBD_ | _TBD_ |
| http_req_failed | < 1% | _TBD_ | _TBD_ |

### 2.4 Finance concurrency

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| /expenses p95 | < 1000 ms | _TBD_ | _TBD_ |
| concurrent_write_seen | ≥ 1 (round-13 race fix is exercised) | _TBD_ | _TBD_ |
| idempotency_dedupe_seen | > 0 (every duplicate POST should dedupe) | _TBD_ | _TBD_ |

**Post-run SQL verification (must equal 0):**
```sql
-- Wallet balance must equal initial - sum(expenses) + sum(incomes)
WITH agg AS (
  SELECT w.id,
         w.balance AS reported,
         w."updatedAt",
         COALESCE((SELECT SUM(amount) FROM expenses e WHERE e."walletId"=w.id AND e."deletedAt" IS NULL), 0) AS spent,
         COALESCE((SELECT SUM(amount) FROM incomes i WHERE i."walletId"=w.id AND i."deletedAt" IS NULL), 0) AS income
  FROM wallets w
  WHERE w."deletedAt" IS NULL
)
SELECT id, reported, income, spent
FROM agg
WHERE reported <> (1000000 + income - spent);
-- Expected: 0 rows. (Replace 1000000 with the seed's opening balance.)
```

### 2.5 AI quota load

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| ai_quota_blocked_seen | > 0 | _TBD_ | _TBD_ |
| ai_chat_succeeded | per-user ≤ daily limit | _TBD_ | _TBD_ |
| AI quota bypass | 0 (no chat 200 after quota fires) | _TBD_ | _TBD_ |

**Post-run SQL:**
```sql
SELECT feature, success, count(*) FROM ai_usage_logs
WHERE "createdAt" > NOW() - INTERVAL '10 minutes' GROUP BY 1, 2;
```

### 2.6 Notification queue load

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| notif_enqueued_ok | matches dispatched count | _TBD_ | _TBD_ |
| Drain time after test ends | < 60 s | _TBD_ | _TBD_ |

**Post-run SQL:**
```sql
SELECT status, count(*) FROM notification_logs
WHERE "createdAt" > NOW() - INTERVAL '5 minutes' GROUP BY status;
-- PENDING ≈ 0, SENT > 0, FAILED ≈ 0 (mock provider never fails).
```

### 2.7 Assistant monitoring load

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| monitor_ok | > 0 | _TBD_ | _TBD_ |
| Rule-only path stays rule-only (no unexpected AI call) | ai_usage_logs delta ≈ 0 | _TBD_ | _TBD_ |

**Post-run SQL:**
```sql
SELECT "userId", type, count(*) FROM ai_recommendations
WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
GROUP BY 1, 2 HAVING count(*) > 1;
-- Expected: 0 rows (dedupe by (userId, type, day)).
```

### 2.8 Soak 2h

| Metric | Threshold | Actual | Pass? |
|--|--|--|--|
| Final p95 vs first 5 min p95 | within ±10% | _TBD_ | _TBD_ |
| Final error rate vs first 5 min | within ±0.5pp | _TBD_ | _TBD_ |
| RAM growth API container | < 50% of limit | _TBD_ | _TBD_ |
| RAM growth worker container | < 50% of limit | _TBD_ | _TBD_ |

Attach the 5-min `/metrics` snapshots inline or as a separate run log.

## 3. Capacity estimate (from measurement, not theory)

> **Honesty rule:** every line below must cite the per-scenario measurement
> that backed it. If a row says "supported", point at the scenario whose
> p95 < threshold and error rate < threshold proved it.

| MAU tier | Status | Evidence |
|--|--|--|
| 1k MAU | _e.g. SUPPORTED today (single API + single worker, ~5 RPS sustained dashboard)_ | _link to scenario result_ |
| 10k MAU | _e.g. SUPPORTED with 2 API replicas (round-15 compose)_ | _link_ |
| 50k MAU | _e.g. SUPPORTED with 4 replicas + Redis+queue + measured pg_stat_activity ≤ 60_ | _link_ |
| 100k MAU | _e.g. CONDITIONAL — need PgBouncer (DB conn ceiling hit at 80k extrapolated)_ | _link_ |
| 500k MAU | _e.g. NOT YET — needs DB read replica + base-backup + WAL archiving (round 17 wired but not validated under load)_ | _link_ |
| 1M MAU | _e.g. NOT YET — needs partitioning + multi-AZ + load test in target region_ | _link_ |

Classification per round-19 ask:

- **supported now**: the actual numbers prove it
- **supported with vertical scale**: bigger instance, no architecture change
- **supported with horizontal API replicas**: more pods, same DB
- **requires DB read replicas**: read RPS exceeds primary's capacity
- **requires partitioning**: DB table size hurts seq scans
- **requires managed Redis/queue**: BullMQ + ElastiCache or equivalent
- **requires multi-AZ**: SLA target requires regional redundancy

## 4. Bottlenecks observed

_(Fill in after the run. Examples: "DB connection pool saturated at 80
concurrent VUs against db.t3.medium — bump to db.t3.large OR introduce
PgBouncer", "Soak: heap grew 200 MB in 2h on the API container — suspect
the assistant cache (round-12 module)").

## 5. Recommended next actions (after the run)

_(Fill in. Examples: "Adopt PgBouncer for production", "Provision a Redis
replica", "Add the BullMQ Prometheus exporter from round-18 backlog").

## 6. Round-19 deliverable disclaimer

This document was created in round 19 as a **template**. The harness
(scripts in `tests/load/`, seed/cleanup helpers, docs above) was
implemented and syntax-validated in this round. The actual numbers must
come from a separate operator-led staging run; the round-19 commit does
NOT contain measured production capacity figures.

When you fill this in, please:
- Replace every `_TBD_` with a real number
- Update the round-19 audit-doc patch to reflect the measured tier
- Open follow-up issues for any threshold that fails
