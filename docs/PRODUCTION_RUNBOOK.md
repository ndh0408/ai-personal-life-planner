# Production Runbook — LifeOS AI v1.0.0

This is the on-call cheat sheet for the LifeOS AI backend. Mobile app issues
without a backend correlation route to the mobile owner; everything else lives
here.

## 0. Topology

```
        Internet  ─►  Cloudflare / Nginx (TLS) ─► 127.0.0.1:3000
                                                         │
                                                docker network
                                                         │
                                          ┌──────────────┼──────────────┐
                                          ▼              ▼              ▼
                                       lifeos-api  lifeos-postgres  lifeos-redis
```

- All container ports are bound to `127.0.0.1` only — direct internet access is
  impossible by design.
- The only public listener is the reverse proxy you put in front of port 3000.
- DB & Redis volumes: `postgres_data`, `redis_data` (named docker volumes).
- Container names: `lifeos-api`, `lifeos-postgres`, `lifeos-redis`.

## 1. Daily ops

### Start / stop

```bash
cd ~/AppQuanLY    # or wherever you cloned the repo on the VPS
docker compose -f docker-compose.production.yml --env-file .env.production up -d
docker compose -f docker-compose.production.yml --env-file .env.production down
```

### Tail logs

```bash
docker compose -f docker-compose.production.yml logs --tail 200 -f api
docker compose -f docker-compose.production.yml logs --tail 200 -f postgres
```

### Health checks

```bash
curl -fsS http://127.0.0.1:3000/api/health         # liveness only
curl -fsS http://127.0.0.1:3000/api/health/ready   # liveness + DB SELECT 1
```

### Container health flags

```bash
docker inspect --format='{{.State.Health.Status}}' lifeos-api
docker inspect --format='{{.State.Health.Status}}' lifeos-postgres
```

## 2. Database

### Migrate

```bash
bash scripts/migrate.sh
# or, against a running container:
docker compose exec api npm run db:migrate:deploy
```

### Backup (manual)

```bash
bash scripts/backup-db.sh   # writes timestamped dump under ./backups/
```

Recommended cron (daily, retain 7):

```cron
15 3 * * * cd /home/deploy/AppQuanLY && /usr/bin/bash scripts/backup-db.sh \
  && find ./backups -name '*.sql.gz' -mtime +7 -delete >> /var/log/lifeos-backup.log 2>&1
```

### Restore

```bash
bash scripts/restore-db.sh ./backups/<dump-file>.sql.gz
```

**Always restore to a staging instance first** if you are practising — restore
DROPs and recreates the DB.

### Open a psql shell

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## 3. Common incidents

### A. API container restart loop

1. `docker compose logs --tail 200 api`
2. If startup fails with `Invalid environment variables: CORS_ORIGIN ...` → confirm `.env.production` has `CORS_ORIGIN=https://...,https://...` (NOT `*`).
3. If startup fails with `JWT_ACCESS_SECRET must be at least 32 chars` → regenerate (`openssl rand -base64 48`) and restart.
4. If `AI_API_KEY is required when AI_PROVIDER is "anthropic"` → either set the key or set `AI_PROVIDER=mock` for emergency degraded mode.

### B. 500 spike

1. Tail logs: `docker compose logs -f api | grep -E 'INTERNAL_SERVER_ERROR|stack'`
2. Look at the last block of `[AllExceptionsFilter] METHOD URL → 500 [ERRORCODE]`. The stack trace is in the next line.
3. If errors mention Prisma / `P10xx`: check DB. If errors mention AI provider: check upstream status (Anthropic / OpenAI dashboard) — the system already falls back to mock output and returns `usedFallback: true`, so users see degraded but functional responses.
4. Roll back: `git checkout v<previous>`, rebuild image (`docker compose build api`), `up -d`.

### C. DB unreachable

1. `docker compose ps` — is `lifeos-postgres` up + healthy?
2. `docker compose exec postgres pg_isready` — quick health probe.
3. Disk full? `df -h` on the VPS. Postgres won't start with no space.
4. Restart the DB only: `docker compose restart postgres`. The API will retry until it succeeds (NestJS bootstraps lazily).

### D. Refresh-token storm / abuse

The auth controller throttles refresh to 30/min/IP. If a single IP is exceeding this, look at `lifeos-postgres` `RefreshToken` table for that user, then revoke:

```sql
UPDATE "RefreshToken" SET "revokedAt" = NOW()
WHERE "userId" = '<user-uuid>' AND "revokedAt" IS NULL;
```

This is equivalent to forcing logout-all on that account. The user must log in again.

### E. CORS rejections from the mobile app

**Mobile clients do not send Origin headers**, so this should not happen. If you see CORS errors from a browser-based admin tool, add its origin to `CORS_ORIGIN` and restart the API container.

### F. Rate-limit complaints

Defaults: global 120/min/user, AI endpoints 12/min/user, auth endpoints 5–30/min/IP. If an honest user is being throttled, raise `THROTTLE_LIMIT` in `.env.production` and restart. Per-route AI limits are hard-coded in `ai.controller.ts` and `assistant.controller.ts`.

## 4. Releases / hotfixes

1. PR merged into `master`.
2. SSH onto VPS:

```bash
cd ~/AppQuanLY
git fetch && git checkout v<new>
docker compose -f docker-compose.production.yml --env-file .env.production build api
bash scripts/migrate.sh                      # runs prisma migrate deploy
docker compose -f docker-compose.production.yml --env-file .env.production up -d
curl -fsS http://127.0.0.1:3000/api/health/ready
```

3. Watch logs for ~5 minutes. If anything looks off, rollback:

```bash
git checkout v<previous>
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build api
```

DB migrations are forward-only; if a migration introduces a problem, you need to write a corrective migration, not roll back.

## 5. Useful one-liners

| Need | Command |
|------|---------|
| Show users + statuses | `docker compose exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c 'SELECT id,email,status,"createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 50;'` |
| Active refresh tokens for a user | `... -c 'SELECT id,"userAgent","ipAddress","createdAt","expiresAt" FROM "RefreshToken" WHERE "userId"=''<uuid>'' AND "revokedAt" IS NULL;'` |
| Revoke all sessions for a user | (see §3D) |
| Count notifications sent today | `... -c 'SELECT type,COUNT(*) FROM "NotificationLog" WHERE "createdAt" > NOW() - INTERVAL ''1 day'' GROUP BY type;'` |
| Dump DB on demand | `bash scripts/backup-db.sh` |
| Container resource use | `docker stats --no-stream` |

## 6. Escalation

| Symptom | First responder | Escalate to |
|---------|-----------------|-------------|
| 5xx > 1% / 5 min | Backend on-call | Tech lead |
| DB down | Backend on-call | DBA / VPS owner |
| AI provider 4xx persistently | Backend on-call | AI ops |
| Mobile app crash on launch | Mobile on-call | Tech lead |
| Auth abuse (credential stuffing) | Backend on-call | Security |

Keep this file updated when topology, env vars, or scripts change.
