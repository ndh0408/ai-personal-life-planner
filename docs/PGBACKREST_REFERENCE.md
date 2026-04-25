# pgBackRest Reference Setup

**Status:** REFERENCE ONLY — round-18 ships docs + the WAL `archive_command`
that pgBackRest can call. Production deployment is the operator's choice;
this doc gets you the rest of the way to Mode B PITR (see
`docs/WAL_ARCHIVING.md`).

> **We do NOT claim production-ready PITR via this doc alone.** A real
> pgBackRest rollout includes capacity planning, repo backup, and a
> quarterly drill. This doc gives you the shape, not the operations.

## When to use pgBackRest vs alternatives

| Choice | When | Trade-off |
|--|--|--|
| **Managed Postgres** (RDS, Cloud SQL, Aiven) | You're not married to self-managed | Provider handles base backup + WAL + PITR. Cheapest in human-time. |
| **pgBackRest** | Self-managed Postgres, prefer mature tooling | Industry standard, repo encryption + compression, PITR + parallel backup. ~1 day to set up cleanly. |
| **Barman** | Same as pgBackRest, prefer simpler config | Less feature coverage, similar reliability. |
| **Roll your own** (`pg_basebackup` + the round-17 `archive-wal.sh`) | Tiny teams, ≤10k MAU pilot | Works but you own the dragons (manifest tracking, retention, parallel restore). |

For LifeOS at the production tier (10k–500k MAU) we recommend a managed
Postgres first, pgBackRest second. This doc covers the pgBackRest path.

## Topology

```
                ┌────────────────────────┐
                │ Postgres primary       │
                │  - archive_command ──► │  pgBackRest CLI (or our archive-wal.sh)
                │  - hot data            │
                └────────────────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │ pgBackRest repository  │
                │  - full backup         │
                │  - diff/incr backups   │
                │  - WAL segments        │
                │  - encrypted at rest   │
                └────────────────────────┘
                            │
                            ▼
                       S3-compatible
                       off-box storage
```

## Configuration sketch — `/etc/pgbackrest/pgbackrest.conf`

```ini
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=2          # keep 2 most-recent full backups
repo1-retention-diff=14         # keep 14 most-recent diff backups
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=CHANGE_ME_AT_LEAST_32_CHARS

# Off-box repository (recommended). Mirror the on-box repo to S3.
repo2-type=s3
repo2-s3-bucket=lifeos-pgbackrest
repo2-s3-region=us-east-1
repo2-s3-endpoint=s3.amazonaws.com
repo2-s3-key=CHANGE_ME
repo2-s3-key-secret=CHANGE_ME
repo2-cipher-type=aes-256-cbc
repo2-cipher-pass=CHANGE_ME_DIFFERENT_FROM_REPO1

start-fast=y
log-level-console=info
log-level-file=detail

[lifeos]
pg1-path=/var/lib/postgresql/16/main
pg1-port=5432
pg1-user=postgres
```

## `postgresql.conf` settings

```ini
wal_level = replica
archive_mode = on
# Either pgBackRest's CLI:
archive_command = 'pgbackrest --stanza=lifeos archive-push %p'
# OR the round-17 `archive-wal.sh` (kept around to demonstrate the contract):
# archive_command = '/opt/lifeos/scripts/archive-wal.sh "%p" "%f"'
archive_timeout = 300s
max_wal_size = 2GB
```

Pick **one** archive_command. Mixing pgBackRest with our round-17 script
will produce two encrypted copies of every WAL segment with two different
keys — confusing on restore. Choose at deploy time and document.

## Daily operations

```bash
# Initial stanza creation (once).
sudo -u postgres pgbackrest --stanza=lifeos stanza-create

# First full backup.
sudo -u postgres pgbackrest --stanza=lifeos backup --type=full

# Incremental backups (daily cron).
sudo -u postgres pgbackrest --stanza=lifeos backup --type=incr

# Diff backup (weekly).
sudo -u postgres pgbackrest --stanza=lifeos backup --type=diff

# Inspect.
sudo -u postgres pgbackrest --stanza=lifeos info
```

Cron suggestion:
```cron
0 2 * * 0 lifeos pgbackrest --stanza=lifeos backup --type=full
0 2 * * 1-6 lifeos pgbackrest --stanza=lifeos backup --type=incr
*/15 * * * * lifeos pgbackrest --stanza=lifeos check
```

## Restore (PITR)

```bash
# Stop Postgres on the target.
sudo systemctl stop postgresql@16-main

# Restore to the most recent backup (no WAL replay).
sudo -u postgres pgbackrest --stanza=lifeos restore --delta

# OR restore to an instant.
sudo -u postgres pgbackrest --stanza=lifeos restore \
  --type=time --target='2026-04-25 09:42:00+07' --delta

# Bring Postgres back. Postgres replays WAL up to the target, then promotes.
sudo systemctl start postgresql@16-main

# Verify with the round-16 sanity script.
DATABASE_URL=postgres://postgres@localhost/lifeos \
  /opt/lifeos/scripts/restore-verify.sh
```

## Security

- **Repo encryption is mandatory** — set `repo1-cipher-type=aes-256-cbc`
  with a 32+ char passphrase. Without it, anyone who reads `repo1-path` or
  the S3 bucket gets your DB.
- **Repo and DB credentials live in `/etc/pgbackrest/pgbackrest.conf`** —
  chmod 600, owner postgres. Don't put it in your secret manager unless
  you template it at deploy time.
- **Use IAM roles for S3 if possible** — avoid long-lived `s3-key`. Drop
  `repo2-s3-key*` from the config and grant the EC2/EKS role
  `s3:GetObject/PutObject` on the bucket prefix.
- **Audit the cipher passphrase rotation** — pgBackRest doesn't re-encrypt
  on rotation. To rotate, take a fresh full backup with the new
  passphrase, then drop the old retention.

## Alerts

Wire these into your monitoring (Round-18 dashboards doc has the full list):

| Alert | Trigger | Severity |
|--|--|--|
| `BackupAge` | `pgbackrest info`'s last backup older than 26h | SEV-2 |
| `WALArchiveFailure` | `archive_command` non-zero in pg log | SEV-1 |
| `RepoSizeGrowth` | repo bytes-per-day > expected | SEV-3 |
| `RepoCheckFailure` | `pgbackrest check` non-zero | SEV-2 |

## RPO / RTO

| Configuration | RPO | RTO |
|--|--|--|
| Daily full + WAL archiving | up to `archive_timeout` (default 300s) | 15-30 min for a fresh restore |
| Daily incr + WAL archiving | same RPO; faster restore | 15 min |
| Add streaming replica | RPO ≈ network lag (sub-second) | 1-5 min |

## Migration from current scripts

Round 16/17 ships logical-dump backups + WAL archiving via shell scripts.
To switch to pgBackRest:

1. Install pgBackRest on the Postgres host (`apt install pgbackrest`).
2. Configure `pgbackrest.conf` (see above).
3. Switch `archive_command` to `pgbackrest archive-push %p`.
4. Take an initial full backup (`pgbackrest backup --type=full`).
5. Disable the round-17 `archive-wal.sh` cron entry so the two paths
   don't compete for WAL segments.
6. Keep `backup-db-encrypted.sh` as a SECONDARY belt-and-suspenders dump
   for ~30 days while you build confidence in pgBackRest, then retire it.
7. Re-run the round-16 drill (`docs/BACKUP_RESTORE_DRILL.md`) using
   `pgbackrest restore` instead of `restore-db-encrypted.sh`.

## What this doc does NOT cover

- Capacity planning for the repo (depends on WAL traffic; expect 5-20 GB
  per million writes per day).
- Cross-region replication of the repo (use S3 cross-region replication
  on the bucket, NOT pgBackRest).
- Streaming replica setup for sub-second RPO (see `pg_basebackup` +
  `recovery.conf` `primary_conninfo`).
- Disaster-recovery drills (`docs/BACKUP_RESTORE_DRILL.md` + a pgBackRest
  variant).

These are operator decisions; this doc just gets you to a working
pgBackRest install.
