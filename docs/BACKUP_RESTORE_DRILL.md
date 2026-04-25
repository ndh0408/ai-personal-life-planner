# Backup + Restore Drill

A quarterly drill — **the only reliable proof your backups work is restoring
one**. Schedule this with the SRE on-call.

## Prerequisites

- A scratch Postgres database (NOT production). Tear it down after the drill.
- The encrypted backup archive you want to test (e.g. yesterday's dump from
  S3).
- The current `BACKUP_ENCRYPTION_KEY` in the operator's secret manager.

## Procedure

```bash
# 1. Spin up scratch DB.
docker run -d --name pgscratch -p 5499:5432 \
  -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=scratch postgres:16

# 2. Pull the encrypted archive locally.
aws s3 cp \
  ${BACKUP_BUCKET}/lifeos-20260415T020000Z.sql.gz.enc /tmp/probe.sql.gz.enc \
  ${BACKUP_S3_ENDPOINT:+--endpoint-url $BACKUP_S3_ENDPOINT}

# 3. Restore into scratch.
DATABASE_URL=postgres://postgres:scratch@localhost:5499/scratch \
BACKUP_ENCRYPTION_KEY=$(security read-secret backup-key) \
./scripts/restore-db-encrypted.sh /tmp/probe.sql.gz.enc

# 4. Sanity checks.
psql postgres://postgres:scratch@localhost:5499/scratch -c '
  SELECT count(*) AS users FROM users;
  SELECT count(*) AS expenses FROM expenses;
  SELECT max("createdAt") AS latest_audit FROM finance_audit_logs;
'

# 5. Tear down.
docker rm -f pgscratch
shred -u /tmp/probe.sql.gz.enc
```

## Pass/fail criteria

- **PASS** if the restore completed without error AND the row counts above
  are within 5% of the production counts AND `latest_audit` is no older
  than `now() - 26 hours` (so we know yesterday's dump captured the most
  recent finance writes).
- **FAIL** triggers an SRE incident review: was the dump corrupted? was
  pg_dump truncated? did encryption succeed but storage failed?

## Recovery time / objective

- **RTO**: 30 minutes for a fresh AZ provision + restore of the most recent
  dump.
- **RPO**: up to 24h (we run nightly dumps; intra-day data is lost in a
  full-host failure). Continuous WAL archiving is on the round-15 backlog.

## Common failure modes

- **`bad decrypt`** — wrong key, or the key was rotated and only the new
  archives are decryptable. Re-fetch the matching key from the secret
  manager.
- **`gzip: invalid magic number`** — the openssl decryption failed silently
  (older OpenSSL builds did not propagate the bad-decrypt error). Check the
  key first.
- **`role "lifeos" does not exist`** — the dump was made with `--no-owner`
  but you're restoring into a DB that doesn't have your service account.
  Pre-create the role or run with `psql -v ON_ERROR_STOP=0`.
