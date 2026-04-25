# Point-in-Time Recovery (PITR) — LifeOS AI

Companion to `docs/WAL_ARCHIVING.md`. This is what you run when you need to
restore the database to a specific instant rather than to "the most recent
nightly dump".

> **Pre-flight reminder:** PITR is only meaningful if you have BOTH a
> physical base backup AND continuous WAL archiving. If you only have
> `pg_dump` outputs, fall back to the standard restore in
> `docs/BACKUP_RESTORE_DRILL.md`.
>
> **Never run this against production.** Always restore into a SCRATCH
> Postgres instance, then promote / fail-over after verification.

## When to use PITR vs nightly restore

| Scenario | Use |
|--|--|
| Last night's data is still acceptable | Nightly restore (`restore-db-encrypted.sh`) |
| Need data from this morning at 09:42 | PITR to `2026-04-25 09:42:00+07` |
| Catastrophic write at known time (rogue migration, accidental DELETE) | PITR to `now() - 1 minute` from the bad event |
| Compliance request "show me state at end-of-quarter" | PITR to that quarter's last instant |

## Inputs you need

- [ ] Physical base backup (e.g. `base.tar.gz` from `pg_basebackup`) **older** than the recovery target
- [ ] All WAL segments **between** the base backup's start LSN and your target
- [ ] `BACKUP_ENCRYPTION_KEY` (or `WAL_ARCHIVE_ENCRYPTION_KEY` if rotated)
- [ ] Recovery target — pick ONE:
  - `recovery_target_time = '2026-04-25 09:42:00+07'`
  - `recovery_target_lsn = '0/1A000000'`
  - `recovery_target_xid = '12345'`
  - `recovery_target_name = 'before-bad-migration'` (if you set a restore point)

## Procedure

```bash
SCRATCH=/var/lib/postgresql/scratch
TARGET="2026-04-25 09:42:00+07"

# 0. Stop the scratch Postgres if running.
sudo systemctl stop postgresql@scratch || true

# 1. Wipe + restore the base backup.
sudo rm -rf "$SCRATCH"
sudo install -d -o postgres -g postgres -m 700 "$SCRATCH"
sudo -u postgres tar -xzf /var/lib/lifeos/backups/base/base-20260424T020000Z.tar.gz \
  -C "$SCRATCH"

# 2. Stage the WAL segments. Decrypt each .enc file into the scratch
#    pg_wal/ directory in the order Postgres needs them.
sudo install -d -o postgres -g postgres -m 700 "$SCRATCH/pg_wal"
for enc in /var/lib/lifeos/wal-archive/*.enc; do
  base="$(basename "$enc" .enc)"
  sudo -u postgres bash -c "
    KEY='$BACKUP_ENCRYPTION_KEY' \
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:KEY \
      -in '$enc' -out '$SCRATCH/pg_wal/$base'
  "
done

# 3. Tell Postgres how to recover.
sudo -u postgres tee "$SCRATCH/postgresql.auto.conf" >/dev/null <<EOF
restore_command = 'cp /var/lib/lifeos/wal-archive-decrypted/%f %p'
recovery_target_time = '$TARGET'
recovery_target_action = 'promote'   # promote when target reached
EOF

# 4. Mark the cluster for recovery.
sudo -u postgres touch "$SCRATCH/recovery.signal"

# 5. Start Postgres on a unique port. It replays WAL up to TARGET and
#    promotes (the promote action prevents accidental further writes).
sudo -u postgres pg_ctl -D "$SCRATCH" -l "$SCRATCH/recovery.log" \
  -o "-p 5499" start

# 6. Watch the log until you see "consistent recovery state reached"
#    followed by "archive recovery complete" or "selected new timeline".
tail -f "$SCRATCH/recovery.log"
```

## Verify with restore-verify.sh

```bash
DATABASE_URL=postgres://postgres@localhost:5499/lifeos \
  ./scripts/restore-verify.sh
```

Same canonical sanity script as the nightly drill — it asserts every
required table exists, the round-16 acceptance tables (users / wallets /
expenses / daily_schedules / ai_recommendations) have rows, and freshness
is within the configured window. Override `MAX_AGE_HOURS` if your recovery
target is intentionally older than today.

## Promote into production (only after verify)

If verify passes AND the recovered data matches what you expect, promote
the scratch instance:

1. Snapshot the broken production volume for forensics.
2. Stop the production Postgres container.
3. Repoint `DATABASE_URL` at the recovered instance OR replace the
   production volume with the scratch one.
4. Bring the API back up: `./scripts/prod-deploy.sh`.
5. Smoke test: `./scripts/prod-smoke-test.sh`.

## Common failure modes

| Symptom | Cause | Fix |
|--|--|--|
| `FATAL: requested recovery stop point is before consistent recovery point` | Target time is older than the base backup | Use an older base backup (or live with the older recovery target) |
| `restore_command failed with exit code 1` | Missing WAL segment | Pull missing `.enc` from off-box storage; re-decrypt |
| `WAL segment %s has been removed` | Base backup is too old; LSN gap | Take a fresher base backup before the next drill |
| `bad decrypt` on WAL segment | Key was rotated between the WAL and your restore | Use the historical key matching that segment's date |
| Postgres won't promote | `recovery_target_action` not set, or Postgres < 12 syntax | Use the `recovery.signal` file (PG12+) and `recovery_target_action='promote'` |

## RPO / RTO

| Recovery target | RPO achievable | RTO achievable |
|--|--|--|
| Most recent WAL applied | `archive_timeout` (default 300s) | 15-30 min depending on dataset size |
| Specific instant | depends on WAL availability at that instant | 30-60 min (extra time to identify target + verify) |

## Drill cadence

PITR is more error-prone than the nightly restore — practise twice a year:
once with `recovery_target_time = 'yesterday at 14:00'`, once with a
`recovery_target_xid` against a synthetic bad transaction. File results in
`docs/incidents/YYYY-MM-DD-pitr-drill.md`.
