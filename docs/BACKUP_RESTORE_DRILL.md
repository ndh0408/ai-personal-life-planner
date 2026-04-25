# Backup + Restore Drill — LifeOS AI

A quarterly drill — **the only reliable proof your backups work is restoring
one**. Schedule with the SRE on-call; capture the result in
`docs/incidents/YYYY-MM-DD-restore-drill.md`.

> **Sister docs:** `docs/ENCRYPTED_BACKUPS.md` (the encryption + storage
> contract), `docs/DISASTER_RECOVERY_RUNBOOK.md` (six failure scenarios),
> `scripts/prod-rollback.md` (image rollback recipes).

## Tiered RPO / RTO targets

| Tier | RPO (max data loss) | RTO (max downtime) | What it takes |
|--|--|--|--|
| **MVP** (≤10k MAU pilot) | 24 h | 60 min | Nightly encrypted dump + manual restore drill quarterly. Today's setup. |
| **Production** (10k–500k MAU) | 1 h | 15 min | Continuous WAL archiving (`docs/WAL_ARCHIVING.md`, scripts shipped in round 17) + a **physical** base backup (depends on topology — `pg_basebackup` or managed-Postgres snapshot) + PITR drill (`docs/PITR_RESTORE.md`). |
| **Enterprise** (500k+ MAU) | 5 min | 5 min | Multi-AZ streaming replication + PITR + automated failover + cross-region async replica. Own program of work. |

The current build is **MVP-tier**. Everything below targets MVP RPO/RTO.
The drill exists to prove we actually meet those numbers.

## Backup retention policy

Implemented by `scripts/prune-backups.sh`. Each archive is hardlinked into
the buckets it represents and pruned independently:

| Bucket | Default keep | Trigger | Why |
|--|--|--|--|
| `daily/` | 14 days | Every successful nightly dump | Same-week recovery — most common drill scenario |
| `weekly/` | 8 weeks | First archive of each ISO week | Catch latent corruption (e.g. silent replication drift week ago) |
| `monthly/` | 12 months | First archive of each calendar month | Compliance + long-tail dispute resolution |

Off-box storage (S3/B2/R2) is the operator's responsibility — see
`docs/ENCRYPTED_BACKUPS.md`. A reasonable lifecycle policy mirrors the
above (14d Standard → 60d IA → Glacier).

## Daily backup procedure (cron)

```cron
# /etc/cron.d/lifeos-backup
0 2 * * * lifeos /opt/lifeos/scripts/backup-db-encrypted.sh \
  >> /var/log/lifeos-backup.log 2>&1
```

The script:
1. Validates env (DATABASE_URL, BACKUP_ENCRYPTION_KEY, tools).
2. Streams `pg_dump | gzip | openssl enc -aes-256-cbc -pbkdf2 -iter 200000`
   directly to disk (plaintext never lands).
3. Optionally uploads to S3 when BACKUP_BUCKET is set.
4. Calls `prune-backups.sh` to apply the tiered retention.

**Never echoes** the encryption key or DB password. Validates with
`-pass env:` to keep secrets off the process arg list.

## Restore drill — quarterly checklist

Reserve 60 min. Schedule on a non-prod day. Use a SCRATCH host (NOT
production, NOT staging that's serving traffic).

### Prerequisites

- [ ] Scratch Postgres on port 5499 (compose file below) with no data
- [ ] The encrypted archive you want to test (preferably yesterday's daily,
      OR one weekly + one monthly to catch silent corruption)
- [ ] Current `BACKUP_ENCRYPTION_KEY` from the secret manager
- [ ] `psql` 16 client on the host
- [ ] `aws` CLI if pulling from S3
- [ ] Note the production row counts beforehand (Step 0)

### Step 0 — capture production baseline

```bash
docker compose -f docker-compose.production.yml --env-file .env.production \
  exec postgres psql -U lifeos -d lifeos -c "
    SELECT 'users'      AS t, count(*) FROM users      UNION ALL
    SELECT 'wallets',     count(*) FROM wallets        UNION ALL
    SELECT 'expenses',    count(*) FROM expenses       UNION ALL
    SELECT 'daily_schedules', count(*) FROM daily_schedules UNION ALL
    SELECT 'ai_recommendations', count(*) FROM ai_recommendations;"
```

Save the output. The drill passes when scratch counts are within ±5%.

### Step 1 — spin up scratch DB

```bash
docker run -d --name pgscratch -p 5499:5432 \
  -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=scratch postgres:16
sleep 5
```

### Step 2 — pull the archive

```bash
# From local disk:
ARCHIVE=/var/lib/lifeos/backups/daily/lifeos-20260424T020000Z.sql.gz.enc

# OR pull from S3:
aws s3 cp \
  ${BACKUP_BUCKET}/lifeos-20260424T020000Z.sql.gz.enc \
  /tmp/probe.sql.gz.enc \
  ${BACKUP_S3_ENDPOINT:+--endpoint-url $BACKUP_S3_ENDPOINT}
ARCHIVE=/tmp/probe.sql.gz.enc
```

### Step 3 — restore into scratch

```bash
DATABASE_URL=postgres://postgres:scratch@localhost:5499/scratch \
BACKUP_ENCRYPTION_KEY="$(your-secret-cmd backup-key)" \
  ./scripts/restore-db-encrypted.sh "$ARCHIVE"
```

### Step 4 — automated verify (canonical sanity)

```bash
DATABASE_URL=postgres://postgres:scratch@localhost:5499/scratch \
  ./scripts/restore-verify.sh
```

This runs the round-16 acceptance checks:
1. Required tables exist (users, wallets, expenses, schedules, AI recs,
   notification_logs, finance_audit_logs, security_audit_logs, …)
2. Canonical tables have rows (users / wallets / expenses /
   daily_schedules / ai_recommendations)
3. Newest row in each canonical table ≤ 26 h old (nightly cadence)

Exit 0 = drill passes. Exit 1 = open an SRE incident review.

### Step 5 — manual deep-check (optional, do this once per year)

```bash
psql postgres://postgres:scratch@localhost:5499/scratch -c "
  SELECT u.email, count(e.id) AS expenses_30d
  FROM users u
  LEFT JOIN expenses e ON e.\"userId\" = u.id
    AND e.\"expenseDate\" > NOW() - INTERVAL '30 days'
  GROUP BY u.email
  ORDER BY expenses_30d DESC LIMIT 5;"
```

Spot-check a known live user account: do their wallets have the expected
balance? Are their AI recommendations from the last 7 days present?

### Step 6 — tear down

```bash
docker rm -f pgscratch
shred -u /tmp/probe.sql.gz.enc 2>/dev/null || rm -f /tmp/probe.sql.gz.enc
```

### Step 7 — file the result

```bash
mkdir -p docs/incidents
cat > docs/incidents/$(date -u +%Y-%m-%d)-restore-drill.md <<'EOF'
# Restore drill — YYYY-MM-DD

- Archive: lifeos-…sql.gz.enc (size, ts)
- restore-db-encrypted.sh exit: 0
- restore-verify.sh exit: 0
- Counts: users=…/…, wallets=…/…, expenses=…/…, schedules=…/…, recs=…/…
- Notes:
EOF
```

## Pass / fail criteria

PASS requires ALL of:

- `restore-db-encrypted.sh` exits 0 with no `bad decrypt` / `gzip: invalid`
  errors.
- `restore-verify.sh` exits 0 (every required table exists, every canonical
  table has rows, every freshness check passes).
- Row counts on `users`, `wallets`, `expenses`, `daily_schedules`,
  `ai_recommendations` are within ±5% of the production baseline captured
  in Step 0.

FAIL on any of the above triggers an SRE incident review:
- Was the dump corrupted at upload time? Re-pull from S3 to compare hash.
- Did pg_dump get truncated by disk-full or signal? Check the cron log.
- Did encryption succeed but storage write fail? Check the prune script
  log for the same date.

## Common failure modes

| Symptom | Likely cause | Fix |
|--|--|--|
| `bad decrypt` | Wrong key, OR key rotated since this archive | Pull the matching key from the secret manager (look up by archive date) |
| `gzip: invalid magic number` | OpenSSL bad-decrypt with older OpenSSL builds (silent) | Same — almost always the key |
| `role "lifeos" does not exist` | Dump was made `--no-owner` but you're restoring into a DB without your service role | Pre-create the role: `CREATE ROLE lifeos LOGIN;` then retry |
| `restore-verify.sh` reports "0 rows" | Restored an old archive when the DB still had data | Wipe scratch + retry from clean Postgres |
| `restore-verify.sh` "freshness > 26h" | Archive is older than expected | Confirm you grabbed the latest daily/, not last week's |
| `permission denied for relation users` | Restoring as `postgres` superuser into a DB owned by `lifeos` | Run `psql ... -v ON_ERROR_STOP=0` once to set GRANT |

## RPO/RTO mapping to backup tier

When the on-call has to choose which tier to restore from:

| Outage age | Tier to use | Why |
|--|--|--|
| 0-24 h | `daily/` newest | RPO = nightly cadence |
| 1-14 d | `daily/` matching date | Close to incident, low data loss |
| 14-60 d | `weekly/` matching ISO week | Daily evicted; weekly is the closest representative |
| > 60 d | `monthly/` matching calendar month | Compliance retrieval |

For the **production tier RPO of 1 h**, switch to the WAL archiving + PITR
pipeline. The scripts (`scripts/archive-wal.sh`,
`scripts/wal-archive-healthcheck.sh`) and the procedure
(`docs/PITR_RESTORE.md`) shipped in round 17. The remaining operational
piece is the base-backup tool (`pg_basebackup` for self-managed, provider
snapshots for managed Postgres) — see `docs/WAL_ARCHIVING.md` "Two
operating modes" for the trade-off.
