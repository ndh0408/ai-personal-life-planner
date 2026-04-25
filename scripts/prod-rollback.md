# Production rollback runbook

Use this when a deploy goes wrong and you need to restore service.
Decision tree first, copy-paste recipes second.

## Decision tree

```
Did the deploy break the API only (5xx / startup loop)?
└─► YES → "Image rollback" (no DB action). Fast: <2 min.
└─► NO  → Did a migration introduce a destructive change?
          ├─► YES → "Image rollback + DB restore" (slow, see Backup-restore drill).
          └─► NO  → Investigate logs first, then choose image rollback if needed.
```

The cheapest action is **always image rollback first**. Migrations in this
repo are additive (column adds, table adds) so the previous image runs fine
against the new schema in 95% of cases.

## A. Image rollback (most common)

```bash
# 1. Identify the previous image. prod-deploy.sh logs it before flipping.
docker image ls lifeos-api --format '{{ .Tag }}\t{{ .CreatedAt }}' | head

# 2. Stop the broken api container.
docker compose -f docker-compose.production.yml --env-file .env.production stop api

# 3. Flip the LIFEOS_API_TAG and bring it back up.
LIFEOS_API_TAG=<previous-tag> \
  docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api

# 4. Verify.
./scripts/prod-smoke-test.sh
```

Success criteria: `prod-smoke-test.sh` exits 0.

## B. Image rollback + DB restore (rare)

Only do this if a migration is destructive (column drop, table rename,
data delete). Read the failed migration first — if it's a column ADD or
index ADD, you do **not** need a DB restore.

```bash
# 1. Stop everything that writes to the DB.
docker compose -f docker-compose.production.yml --env-file .env.production stop api worker

# 2. Restore from the most recent encrypted backup.
#    See docs/BACKUP_RESTORE_DRILL.md for the full procedure. Short form:
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)" \
BACKUP_ENCRYPTION_KEY="$(grep -E '^BACKUP_ENCRYPTION_KEY=' .env.production | cut -d= -f2-)" \
  ./scripts/restore-db-encrypted.sh /var/lib/lifeos/backups/<latest>.sql.gz.enc \
    --i-know-this-is-production

# 3. Bring the previous image back (see section A).
LIFEOS_API_TAG=<previous-tag> \
  docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api

# 4. Verify.
./scripts/prod-smoke-test.sh
```

RPO during step 2 is the gap between the latest dump and the moment of the
failed migration (≤24 h with current nightly schedule). Round-15 backlog
includes WAL archiving for sub-hour RPO.

## C. Worker-only rollback

Workers are stateless. Roll them back independently of the API:

```bash
LIFEOS_API_TAG=<previous-tag> \
  docker compose -f docker-compose.production.yml --env-file .env.production \
  --profile worker up -d --no-deps worker
```

## D. Verify after any rollback

```bash
./scripts/prod-smoke-test.sh
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=200 api
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=200 worker || true
curl -s http://127.0.0.1:3000/api/health/ready | jq .
```

## E. After the rollback — incident hygiene

1. Open an incident note in `docs/incidents/YYYY-MM-DD-<slug>.md` (create
   the directory if it doesn't exist).
2. Capture: timeline, image tags involved, migration name (if any), root
   cause hypothesis, follow-up tasks.
3. Add a regression test for whatever broke.
4. Re-deploy when fixed using `./scripts/prod-deploy.sh`.

## Common failure modes

| Symptom | Likely cause | Action |
|--|--|--|
| api healthcheck never goes green | DB env mismatch / Prisma client out of sync | Section A image rollback; double-check `.env.production` and re-run `prod-migrate.sh` |
| 401 on every request from mobile | JWT secret rotated mid-deploy | Restart all api/worker containers AFTER setting the new secrets; expect every user to re-login |
| 503 with `AI_DAILY_LIMIT_REACHED` floods | A single misbehaving user; not a deploy bug | Inspect `ai_usage_logs`; raise the user's plan or throttle the client |
| `redis: down` in /health/ready | Redis container died OR `QUEUE_ENABLED=true` but `REDIS_URL` unset | `docker compose ... up -d redis`; recheck env |
| 429 storm immediately post-deploy | Rate-limit counter reset evicted; mobile retried in lockstep | Wait one window (60s) and check again; usually self-heals |
| `BAD_REQUEST` on /auth/reset-password | Token from email predates the latest deploy | Have user request a new reset email |
