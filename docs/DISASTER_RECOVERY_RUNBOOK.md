# Disaster Recovery Runbook — LifeOS AI

On-call playbook for the six failure classes the SRE on-call should be ready
to handle without escalation. Each scenario lists: detection signal,
immediate action, recovery, post-incident hygiene.

> **Audience:** the on-call engineer at 03:00 staring at PagerDuty.
> **Sister docs:** `docs/PRODUCTION_RUNBOOK.md` (daily ops),
> `docs/BACKUP_RESTORE_DRILL.md` (recovery drill),
> `scripts/prod-rollback.md` (image rollback recipes).

## Severity tiers

| Tier | Wall-clock impact | Examples |
|--|--|--|
| SEV-1 | API entirely down or data loss in flight | DB primary crash without backup, encrypted-volume corruption |
| SEV-2 | Major feature broken, partial 5xx | Redis crashed (queue stalled), bad deploy 5xx-ing |
| SEV-3 | Degraded but functional | AI provider outage (mock fallback fires), notification provider down |

## Scenario A — Postgres primary crash (SEV-1)

**Detection:** `/api/health/ready` reports `database:"down"`; api 5xx storm
on every endpoint that hits the DB; `lifeos-postgres` healthcheck red.

**Immediate (≤2 min):**
```bash
docker compose -f docker-compose.production.yml --env-file .env.production ps
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail 200 postgres
df -h | grep -E 'Mounted|/var/lib/docker'   # disk full?
```

**Decision:**
- **Container died but volume intact** → `docker compose ... restart postgres`, watch `pg_isready`. The api retries automatically (Prisma connection pool); no API restart needed.
- **Volume corrupted (start refuses)** → Section "DB restore from encrypted backup" below. Expect 10-30 min downtime depending on dump size.

**DB restore from encrypted backup:**
```bash
# 1. Stop everything that writes to the DB.
docker compose -f docker-compose.production.yml --env-file .env.production stop api worker

# 2. Wipe the broken volume (only if you've already confirmed it's
#    unrecoverable — otherwise snapshot it for forensics first).
docker compose -f docker-compose.production.yml --env-file .env.production rm -fv postgres
docker volume rm appquanly_postgres_data || true

# 3. Bring postgres back with an empty volume.
docker compose -f docker-compose.production.yml --env-file .env.production up -d postgres

# 4. Restore the most recent encrypted dump.
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)" \
BACKUP_ENCRYPTION_KEY="$(grep -E '^BACKUP_ENCRYPTION_KEY=' .env.production | cut -d= -f2-)" \
  ./scripts/restore-db-encrypted.sh /var/lib/lifeos/backups/daily/<latest>.sql.gz.enc \
    --i-know-this-is-production

# 5. Verify before reopening to traffic.
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)" \
  ./scripts/restore-verify.sh

# 6. Bring api + worker back up.
./scripts/prod-deploy.sh
./scripts/prod-smoke-test.sh
```

**Post-incident:** open `docs/incidents/YYYY-MM-DD-postgres-restore.md`,
record RTO actual vs target, capture which backup tier (daily/weekly/
monthly) the restore came from. Bump the alarm thresholds if disk-full was
the cause.

## Scenario B — Redis crash (SEV-2)

**Detection:** `/api/health/ready` reports `redis:"down"`; notification
queue depth on `/metrics` flatlines; mobile push delivery stops; throttler
falls back to in-memory (not catastrophic, but per-pod limits drift).

**Immediate (≤1 min):**
```bash
docker compose -f docker-compose.production.yml --env-file .env.production restart redis
docker compose -f docker-compose.production.yml --env-file .env.production exec redis redis-cli ping
```

**If volume corrupt:** Redis state is **non-canonical** in this build
(BullMQ jobs are durable but stateless; throttler counters are a window we
can lose; rate-limit counts will reset). Just reset the volume:
```bash
docker compose -f docker-compose.production.yml --env-file .env.production rm -fv redis
docker volume rm appquanly_redis_data || true
docker compose -f docker-compose.production.yml --env-file .env.production up -d redis
```

**Notification backlog:** any job that was mid-flight when Redis died is
gone, but `notification_logs` rows stay PENDING in Postgres. After Redis is
back, manually re-enqueue them (one-shot psql + curl; small enough that we
do it by hand rather than ship an admin endpoint):
```sql
-- Inspect the backlog first.
SELECT count(*) FROM notification_logs
WHERE status = 'PENDING' AND "createdAt" > NOW() - INTERVAL '24 hours';
```
For each row, hit `POST /api/internal/notifications/redispatch/:id` (admin
endpoint; not implemented in v1.4 — use a future round-16+ admin job, or
restart the api so the dispatcher's startup hook picks them up).

**Post-incident:** confirm BullMQ failed-jobs count is back to baseline:
```bash
curl -s http://127.0.0.1:3000/api/health/ready | jq .queues
```

## Scenario C — AI provider outage (SEV-3)

**Detection:** `lifeos_ai_calls_total{outcome="error"}` rises sharply on
`/metrics`; user reports of "AI is being weird"; api logs show
`AI_PROVIDER_FAILED` or `AI_TIMEOUT` errorCode at high rate.

**No outage required:** the orchestrator already retries twice + falls back
to the mock provider, and the AI usage ledger logs `success=false`. Users
see degraded AI text but the rest of the app works.

**If the upstream is the cause:** verify on the provider's status page
(Anthropic, OpenAI, OpenRouter). No action required — the existing fallback
is the design.

**If a single user is hammering the platform key:**
```sql
SELECT "userId", count(*) FROM ai_usage_logs
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "userId" ORDER BY count(*) DESC LIMIT 10;
```
Throttle them via the per-user daily cap (round 12); admin can also flip
their `aiUsageQuota.plan` to a stricter tier or set their daily limits to
0 to deny temporarily.

**If you want to flip the platform to mock urgently** (cost containment):
```bash
# Edit .env.production: AI_PROVIDER=mock
docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api
```
Mobile responses will return `usedFallback: true` so the UI can mention
"reduced AI mode".

## Scenario D — Notification provider outage (SEV-3)

**Detection:** Expo Push API returning 5xx; `lifeos_notifications_total{outcome="error"}` rising; user reports of "no push notifications".

**Immediate:** the notification worker already retries with exponential
backoff (round 12 default: 5 attempts, 5s exponential). The PENDING rows
stay in `notification_logs` — they'll be drained as soon as Expo is back.

**If you need to drain the backlog faster** (rare):
```bash
# Check backlog size.
docker compose -f docker-compose.production.yml --env-file .env.production \
  exec postgres psql -U lifeos -d lifeos -c \
  "SELECT count(*) FROM notification_logs WHERE status='PENDING';"

# If the dispatcher is stuck in retry storm, scale up worker concurrency.
# Edit .env.production: WORKER_CONCURRENCY_NOTIFICATION=20
docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api
```

**INVALID_TOKEN spike** (e.g. iOS device wiped en masse): the worker
auto-deactivates devices that return INVALID_TOKEN, so the backlog
self-heals. Verify:
```sql
SELECT count(*) FROM notification_devices WHERE "isActive" = false;
```

## Scenario E — Bad deployment / 5xx storm (SEV-2)

**Detection:** `lifeos_http_requests_total{status_class="5xx"}` rate jumps
right after a deploy; mobile error-rate dashboard spikes.

**Immediate (≤2 min):** image rollback. Full recipe in
`scripts/prod-rollback.md`. TL;DR:
```bash
docker image ls lifeos-api --format '{{.Tag}}\t{{.CreatedAt}}' | head
LIFEOS_API_TAG=<previous-tag> \
  docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api
./scripts/prod-smoke-test.sh
```

**Migration safety:** all migrations in this repo are additive (column add,
table add, index add). The previous image runs against the new schema in
99% of cases. If a migration genuinely broke (column rename, FK change),
escalate to Scenario F.

## Scenario F — Migration failed mid-deploy (SEV-1)

**Detection:** `prisma migrate deploy` exited non-zero; `prisma migrate
status` lists a `failed` migration; `prod-deploy.sh` aborted before
restarting the api.

**Critical:** **do not** delete the failed migration directory, do not run
`prisma migrate reset`, do not edit the broken migration's SQL. The
existing api keeps serving requests against the pre-migration schema.

**Immediate triage:**
```bash
# 1. What's the state?
docker compose -f docker-compose.production.yml --env-file .env.production \
  run --rm --no-deps --entrypoint "" api sh -c \
  'cd apps/api && npx prisma migrate status'

# 2. What did the broken migration try to do?
ls -la apps/api/prisma/migrations/<failed-migration>/
cat apps/api/prisma/migrations/<failed-migration>/migration.sql
```

**Decision tree:**
- **Migration partially applied (some tables changed):**
  ```bash
  # 1. Manually finish or rollback in psql with a transaction.
  docker compose ... exec postgres psql -U lifeos -d lifeos
  # BEGIN; ... ROLLBACK; / COMMIT;

  # 2. Mark the migration as rolled back in Prisma's history table.
  docker compose ... run --rm --no-deps --entrypoint "" api sh -c \
    "cd apps/api && npx prisma migrate resolve --rolled-back <migration-name>"

  # 3. Roll the code back to the previous tag (Section E).
  ```
- **Migration not yet applied (caught at first ALTER):**
  ```bash
  # Just mark it rolled back and roll the code back.
  docker compose ... run --rm --no-deps --entrypoint "" api sh -c \
    "cd apps/api && npx prisma migrate resolve --rolled-back <migration-name>"
  ```

**Forward fix:** write a NEW migration that completes the change correctly
(do NOT edit the broken one — Prisma's checksum will mismatch on every
other dev's machine). Land it in a follow-up deploy.

**Post-incident:** the migration that broke needs a regression — add a
`prisma migrate diff --from-migrations` step to CI so the same shape can't
land again.

## PITR (point-in-time recovery)

Available **only** when WAL archiving + a physical base backup are both in
place. See `docs/PITR_RESTORE.md` for the full procedure. Use PITR for:

- Catastrophic write at a known instant (rogue migration, mass DELETE)
- Compliance request to reconstruct state at end-of-quarter

PITR is destructive on the target — always restore into a SCRATCH
Postgres, then promote.

## RPO / RTO targets — see BACKUP_RESTORE_DRILL.md

The numeric targets per tier (MVP / production / enterprise) live in the
drill doc so the SRE and the product owner share one source of truth.

## When to escalate

| Trigger | Escalate to |
|--|--|
| SEV-1 unresolved at T+15 min | Backend tech lead |
| Data loss confirmed | Backend tech lead + DBA |
| Multi-day Redis or notification provider outage | Product (set user expectations) |
| AI provider outage > 4 h with cost-containment risk | Finance (credit limit) |
| Auth abuse (credential stuffing, mass password-reset abuse) | Security |
