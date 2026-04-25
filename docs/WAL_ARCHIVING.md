# WAL Archiving — LifeOS AI

Round-17 design doc for shipping WAL archive_command + monitoring. Pair with
`docs/PITR_RESTORE.md` for the recovery path.

> **Important — what this is NOT:** the existing `scripts/backup-db-encrypted.sh`
> produces **logical** dumps via `pg_dump`. WAL archiving + a logical dump is
> NOT a complete PITR setup — to roll forward to an arbitrary instant you
> need a **physical base backup** (taken with `pg_basebackup` against the
> same primary that's emitting the WAL). The two MVP/production modes
> below cover both cases honestly.

## Two operating modes

### Mode A — MVP (current build, ≤10k MAU)

- Nightly **logical** encrypted dump (`backup-db-encrypted.sh`).
- WAL archiving **off**.
- RPO = 24 h, RTO = 60 min.
- Restore = decrypt + `psql < dump.sql`. No PITR.

This is what ships today and what the round-16 drill targets.

### Mode B — Production PITR (10k–500k MAU)

You need ALL of the following, in this order:

1. A **physical base backup** taken via `pg_basebackup` (or your managed
   Postgres provider's snapshot tool — RDS, Cloud SQL, etc.). The dump from
   `pg_dump` is NOT a base backup; restoring it produces a logically
   equivalent DB but with a different LSN history, so WAL replay against it
   is meaningless.
2. Continuous **WAL archiving** to off-box storage via `archive_command`.
3. Both encrypted with the same key family.
4. A documented restore procedure tested quarterly (`docs/PITR_RESTORE.md`).

The scripts in this repo (`archive-wal.sh`, `wal-archive-healthcheck.sh`)
implement step 2. Step 1 is left to the operator because the right base
backup tool depends on the deployment topology:

| Topology | Base backup tool |
|--|--|
| Self-managed Postgres in compose | `pg_basebackup -D base.tar -F t -X none -P` from a sidecar container |
| RDS / Aurora / Cloud SQL | Provider's automated snapshot + WAL/redo archiving (already configured by the provider — set `archive_command` to a no-op) |
| Self-managed on bare metal | `pgBackRest` or `Barman` (production-grade tooling on top of `archive_command`) |

For LifeOS at the 10k–500k MAU tier we recommend **moving to a managed
Postgres** (RDS or equivalent) so the base-backup path is the provider's
responsibility. Self-running pgBackRest is doable but the operational cost
exceeds the SaaS bill until you're past ~500k MAU.

## Required PostgreSQL settings (Mode B)

In `postgresql.conf` (or via `ALTER SYSTEM SET`):

```ini
wal_level = replica            # 'replica' is enough for archiving + standby
archive_mode = on
archive_command = '/opt/lifeos/scripts/archive-wal.sh "%p" "%f"'
archive_timeout = 300s         # force a switch every 5 min (RPO floor 5 min)
                               # raise to 900s if WAL volume is too high
max_wal_senders = 4            # only needed if you also stream to a standby
max_wal_size = 2GB             # tune to disk; pre-300s timeout this is most-used
```

Restart Postgres (or `SELECT pg_reload_conf()` for archive_command + timeout).

## Script — `scripts/archive-wal.sh`

Run by Postgres for every completed WAL segment. Produces an
AES-256-CBC-encrypted copy in `WAL_ARCHIVE_DIR` and (optionally) uploads to
S3-compatible storage.

### Env contract

| Var | Required? | Default | Notes |
|--|--|--|--|
| `WAL_ARCHIVE_ENCRYPTION_KEY` | yes (or `BACKUP_ENCRYPTION_KEY`) | — | ≥32 chars |
| `WAL_ARCHIVE_DIR` | no | `/var/lib/lifeos/wal-archive` | local spool |
| `WAL_ARCHIVE_MODE` | no | `local` | `local` / `s3` / `disabled` |
| `WAL_S3_BUCKET` | when mode=s3 | — | `s3://bucket/path` |
| `WAL_S3_ENDPOINT` | optional | — | R2/B2/MinIO endpoint |
| `WAL_S3_ACCESS_KEY_ID` | when mode=s3 | — | provider key |
| `WAL_S3_SECRET_ACCESS_KEY` | when mode=s3 | — | provider secret |

### Idempotency + crash recovery

- A `flock`-held per-segment lockfile prevents two concurrent archive runs
  for the same WAL from corrupting the encrypted output.
- A sibling `.ok` marker is created **after** the encrypted file is on disk
  AND any S3 upload succeeded. Postgres re-invokes `archive_command` after
  a crash mid-archive; on the second run we see the `.ok` marker and skip
  the segment without re-encrypting (random IV would produce a different
  ciphertext anyway).
- Exit codes: `0` success / `1` misconfig / `2` IO / `3` upload — Postgres
  retries on any non-zero. Misconfig (`1`) means Postgres will retry
  forever; alert on stale archive (see healthcheck) so a human catches it.

### Smoke test (synthetic WAL, local mode)

```bash
WAL=/tmp/000000010000000000000001
head -c 16777216 /dev/urandom > "$WAL"
WAL_ARCHIVE_DIR=/tmp/spool \
WAL_ARCHIVE_MODE=local \
WAL_ARCHIVE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  ./scripts/archive-wal.sh "$WAL" "000000010000000000000001"
ls -la /tmp/spool/    # → 000…01.enc + 000…01.enc.ok
```

A duplicate run with a *different* key still exits 0 — because the `.ok`
marker says "we already archived this segment", which is the desired
behaviour for Postgres crash recovery.

## Script — `scripts/wal-archive-healthcheck.sh`

Run from cron (1-min cadence) or wired into your monitoring agent. Three
failure modes:

| Exit code | Meaning |
|--|--|
| 0 | Healthy — newest .enc is fresher than `MAX_AGE_MINUTES`, backlog under cap, disk under cap |
| 1 | Stale (no fresh archive — `archive_command` is failing or WAL traffic stopped) |
| 2 | Backlog (segments missing `.ok` markers — uploads keep failing) |
| 3 | Disk pressure (spool mount above `DISK_WARN_PERCENT`) |
| 4 | Misconfig (spool dir missing) |

### Env contract

| Var | Default | Notes |
|--|--|--|
| `WAL_ARCHIVE_DIR` | `/var/lib/lifeos/wal-archive` | matches archive-wal.sh |
| `MAX_AGE_MINUTES` | 10 | tighten to 5 for higher RPO targets |
| `ALERT_BACKLOG` | 50 | bump if you have a slow upload pipe |
| `DISK_WARN_PERCENT` | 85 | mounted disk usage threshold |

### Cron

```cron
*/1 * * * * lifeos /opt/lifeos/scripts/wal-archive-healthcheck.sh \
  >> /var/log/lifeos-wal-health.log 2>&1
```

Pipe non-zero exits into your alerting (PagerDuty / Slack webhook). The
script keeps the log small — one line per run.

## RPO / RTO with WAL archiving on

| Tier | RPO | RTO | What's needed |
|--|--|--|--|
| MVP (logical dump only) | 24 h | 60 min | Today |
| Production (WAL + base backup) | `archive_timeout` (default 300s) | 15 min | Mode B + scripted PITR drill |
| Enterprise | 5 min | 5 min | Multi-AZ streaming replication + automated failover (own program) |

## Operational warnings

- **Never test PITR on a production database.** Always restore into a
  staging instance you can wipe. The PITR procedure (`docs/PITR_RESTORE.md`)
  is destructive on the target.
- **Never expose the encryption key.** `archive-wal.sh` reads it from env
  via `openssl ... -pass env:KEY` so it never appears in `ps`. The cron
  user's environment file (`/etc/cron.d/...` referencing a sourced env
  file) is the only place it lives.
- **Watch the spool disk.** If `archive_command` keeps succeeding locally
  but S3 uploads fail, segments accumulate in `WAL_ARCHIVE_DIR`. The
  healthcheck catches this via the `backlog` exit code (2) and the disk
  exit code (3).
- **Don't run two writers against the same spool.** Crashes plus
  re-invocation are handled by the per-segment `flock`, but two SEPARATE
  Postgres instances pointing at the same `WAL_ARCHIVE_DIR` will produce
  conflicting `.ok` markers. Each Postgres gets its own dir.

## What round-17 ships vs what's left

| Capability | Status |
|--|--|
| `archive_command` script with encryption + idempotency | ✅ done |
| Healthcheck script with three failure modes | ✅ done |
| Local spool + S3 upload code path | ✅ done (S3 path tested in local-only smoke; live S3 needs operator config) |
| Documentation of the two operating modes | ✅ done |
| `pg_basebackup` / managed-Postgres base backup wiring | ❌ deferred — depends on production topology choice |
| Automated PITR drill | ❌ deferred — once base-backup tool is chosen |
| Streaming replica | ❌ enterprise-tier, separate program |
