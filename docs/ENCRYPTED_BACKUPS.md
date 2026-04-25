# Encrypted Backups

Round 14 introduced two scripts:

- `scripts/backup-db-encrypted.sh` — `pg_dump | gzip | openssl enc → optional S3 upload`.
- `scripts/restore-db-encrypted.sh` — `openssl dec | gunzip | psql`.

Both honour env-var configuration only. **Nothing reads or writes the encryption
key from disk** — it is passed via `openssl ... -pass env:BACKUP_ENCRYPTION_KEY`,
which keeps the secret off the process arg list (where `ps` would see it).

## Algorithm

- `openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000`
- IV is randomised per backup and embedded in the ciphertext header.
- 200000 PBKDF2 iterations matches OWASP's 2024 SHA-256 guidance.

## Required env

```
DATABASE_URL              postgres://… (the source)
BACKUP_ENCRYPTION_KEY     >= 32 chars (generate via `openssl rand -hex 32`)
BACKUP_DIR                local working dir (default /var/lib/lifeos/backups)
```

## Optional off-box upload

```
BACKUP_BUCKET             s3://bucket/path
BACKUP_S3_ENDPOINT        custom S3 endpoint (Backblaze B2, R2, etc.)
BACKUP_ACCESS_KEY_ID      provider access key
BACKUP_SECRET_ACCESS_KEY  provider secret
```

When `BACKUP_BUCKET` is set, the script uses the `aws` CLI to upload the
encrypted file. We deliberately use the AWS CLI (not the SDK) so a single
binary covers all S3-compatible providers without dragging Node into the
backup path.

## Local retention

The script keeps the last 14 days of encrypted dumps in `BACKUP_DIR`; older
files are deleted by `find -mtime +14 -delete`. Off-box retention is the
operator's responsibility (S3 lifecycle policy or equivalent).

## Cron schedule

```
# /etc/cron.d/lifeos-backup
0 2 * * * lifeos /opt/lifeos/scripts/backup-db-encrypted.sh
```

Run as a service-account user with read-only DB credentials.

## Key rotation

1. Decrypt every existing dump with the current key (`restore-db-encrypted.sh`
   into a scratch DB).
2. Re-dump with the new key.
3. Update `BACKUP_ENCRYPTION_KEY` in the operator's secrets manager.
4. Wait one retention cycle (14d) before destroying the old key.

## Dry-run

```
./scripts/backup-db-encrypted.sh --dry-run
```

Validates env + tool availability without producing an encrypted file.
