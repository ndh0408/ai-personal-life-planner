# Production Deploy Rehearsal — LifeOS AI

This is the "first time deploying to a real VPS" rehearsal. Every command is
copy-paste-able. Run on a staging host that mirrors production, then again on
production once staging is green.

> **Audience:** the on-call SRE doing the first real deploy.
> **Goal:** zero-surprise launch — every check from rounds 11-14 is wired,
> every backstop works, rollback is a single command.

## 0. Pre-flight checklist (T-24h)

- [ ] You have SSH + sudo on the target VPS.
- [ ] You have a fresh DNS A/AAAA record (e.g. `api.example.com`) pointing
      to the VPS public IP. **Do not** point the mobile client at it yet.
- [ ] You have the **15 secrets** below in your password manager:
      `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
      `AI_PROVIDER_ENCRYPTION_KEY`, `AI_API_KEY`, `METRICS_BEARER_TOKEN`,
      `BACKUP_ENCRYPTION_KEY`, `SMTP_*` (5 vars when using SMTP).
- [ ] You read `docs/AUTH_SECURITY.md`, `docs/ENCRYPTED_BACKUPS.md`, and
      `docs/ROUND_14_AUTH_PRIVACY_HARDENING.md`.
- [ ] You picked a release tag (e.g. `v1.4.0`).

Generate the strong secrets locally:

```bash
openssl rand -base64 48     # JWT_ACCESS_SECRET (and a separate one for refresh)
openssl rand -hex 32        # AI_PROVIDER_ENCRYPTION_KEY
openssl rand -hex 32        # METRICS_BEARER_TOKEN
openssl rand -hex 32        # BACKUP_ENCRYPTION_KEY
openssl rand -base64 24     # POSTGRES_PASSWORD
```

## 1. VPS / cloud setup

```bash
# Ubuntu 22.04+ recommended.
sudo apt-get update && sudo apt-get install -y \
  ca-certificates curl gnupg jq nginx ufw certbot python3-certbot-nginx

# Docker Engine + Compose v2 (official repo)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out/in so the group takes effect
docker compose version    # must report >= 2.20

# Open only what we need.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Provision a dedicated service user:

```bash
sudo adduser --system --group --home /opt/lifeos lifeos
sudo usermod -aG docker lifeos
sudo install -d -o lifeos -g lifeos /opt/lifeos /var/lib/lifeos/backups
```

## 2. Clone repo + secrets

```bash
sudo -u lifeos -H bash <<'EOS'
cd /opt/lifeos
git clone https://github.com/<org>/lifeos.git .
git checkout v1.4.0
cp .env.production.example .env.production
chmod 600 .env.production
EOS
```

Edit `/opt/lifeos/.env.production` with the secrets you generated. The new
**round-15 keys** to fill in this file:

```
POSTGRES_PASSWORD=...
DATABASE_URL=postgresql://lifeos:<POSTGRES_PASSWORD>@postgres:5432/lifeos?schema=public&connection_limit=10&pool_timeout=20
JWT_ACCESS_SECRET=...                   # 48 base64 chars
JWT_REFRESH_SECRET=...                  # 48 base64 chars (different)
AI_PROVIDER=anthropic                   # or openai / mock
AI_API_KEY=...
AI_MODEL=claude-opus-4-7
AI_PROVIDER_ENCRYPTION_KEY=...          # 64 hex chars
CORS_ORIGIN=https://app.example.com     # mobile/web origins, comma-separated
APP_PUBLIC_URL=https://app.example.com  # used in verify-email + reset-password links

# Round 12 — queue + observability
QUEUE_ENABLED=true
REDIS_URL=redis://redis:6379
METRICS_ENABLED=true
METRICS_BEARER_TOKEN=...                # 64 hex chars

# Round 14 — encrypted backups (only the key here; bucket later)
BACKUP_ENCRYPTION_KEY=...               # 64 hex chars
```

The API refuses to boot in production if any of these are missing or weak
(see `apps/api/src/config/env.validation.ts`). That's intentional — better
to fail loud than to silently disable security.

## 3. Database setup (Postgres 16)

The compose file ships Postgres. No manual install needed. Bring it up
first so we can apply migrations against an empty volume.

```bash
cd /opt/lifeos
docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d postgres
docker compose -f docker-compose.production.yml --env-file .env.production \
  exec postgres pg_isready -U lifeos -d lifeos
```

For a managed DB (RDS, Cloud SQL): set `DATABASE_URL` accordingly and skip
starting the postgres container. `connection_limit=10` is a safe default
for a single-replica deploy; bump to `(max_connections - 10) / replicas`
when you scale horizontally (see `.env.production.example` for the math).

## 4. Redis setup

Same — compose owns it. To verify:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d redis
docker compose -f docker-compose.production.yml --env-file .env.production \
  exec redis redis-cli ping       # → PONG
```

To use a managed Redis: set `REDIS_URL=rediss://...` and skip starting the
redis container.

## 5. Migration (idempotent)

```bash
./scripts/prod-migrate.sh
```

This runs `prisma migrate deploy` inside a disposable container that uses
the same image as the api service, so the Prisma binary version matches.
It logs the migration history before AND after so you have a snapshot for
the change-log.

> **Seed safety:** the demo seed (`apps/api/prisma/seed.ts`) refuses to run
> when `NODE_ENV=production` unless you explicitly pass
> `ALLOW_SEED_IN_PRODUCTION=true`. There is no scenario in production where
> you should override this.

## 6. Start the API

```bash
./scripts/prod-deploy.sh
```

The script:
1. Validates `.env.production` for required keys (round-12 + round-14).
2. Captures the previous image tag in the script log (for rollback).
3. Builds a new `lifeos-api:${LIFEOS_API_TAG:-latest}` image.
4. Brings postgres + redis up if not already running.
5. Runs `prod-migrate.sh`.
6. Restarts the api container.
7. Polls `/api/health/ready` for up to 60s.

To pin a tag:

```bash
LIFEOS_API_TAG=v1.4.0 ./scripts/prod-deploy.sh
```

## 7. Start the worker (optional, for higher load)

For ≤500k MAU the api process drains queues itself. To run a dedicated
worker container:

```bash
LIFEOS_API_TAG=v1.4.0 ./scripts/prod-deploy.sh --with-worker
```

The `worker` service in compose uses the **same image** with `METRICS_ENABLED=false`
and no port mapping. It's stateless and can be restarted independently.

## 8. Health check

```bash
# Liveness — cheap process ping (use for k8s/PM2 livenessProbe).
curl -s http://127.0.0.1:3000/api/health | jq .
# {"status":"ok","service":"planner-api","timestamp":"..."}

# Readiness — DB + Redis + queue depth (use for readinessProbe).
curl -s http://127.0.0.1:3000/api/health/ready | jq .
# {
#   "status":"ready",
#   "database":"up",
#   "redis":"up",
#   "queues":{ "notification-queue":{...}, "ai-queue":{...}, ... }
# }
```

A `redis:"disabled"` reading in production means `QUEUE_ENABLED` is unset —
fix the env and `docker compose ... up -d --no-deps api`.

## 9. Smoke test

```bash
./scripts/prod-smoke-test.sh
# Runs 7 probes: liveness, readiness, login-with-junk, forgot-password
# no-leak, rate-limit headers, /metrics gating, 5xx leak check.
# Exits 0 only if every required check passes.
```

To also verify the metrics endpoint:

```bash
METRICS_BEARER_TOKEN="$(grep -E '^METRICS_BEARER_TOKEN=' .env.production | cut -d= -f2-)" \
  ./scripts/prod-smoke-test.sh
```

## 10. Nginx + HTTPS

Sample `/etc/nginx/sites-available/lifeos`:

```nginx
server {
  listen 80;
  server_name api.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  # Don't leak nginx version
  server_tokens off;

  # Pass through the request id added by middleware (round 11).
  proxy_set_header X-Request-Id $request_id;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;

  # Make the throttler see the real client IP (round 12).
  set_real_ip_from 10.0.0.0/8;
  real_ip_header X-Forwarded-For;

  client_max_body_size 8m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_read_timeout 60s;
  }

  # Lock /metrics to your monitoring network only.
  location = /metrics {
    allow 10.0.0.0/8;          # adjust to your VPC / Prometheus IP
    deny all;
    proxy_pass http://127.0.0.1:3000;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lifeos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.example.com --redirect --non-interactive --agree-tos -m ops@example.com
```

CORS is enforced by the API — `CORS_ORIGIN` in `.env.production` must list
the exact mobile/web HTTPS origin. The API refuses to start if it's empty
or `*` in production (verified on boot).

## 11. Rate-limit verification (round 12 + 14)

```bash
# Per-IP: hammer login. After ~10 hits/min you should get 429.
for i in {1..15}; do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -H 'Content-Type: application/json' \
    -d '{"email":"x@x.x","password":"x"}' \
    https://api.example.com/api/auth/login
done

# Per-account lockout (round 14): 5 wrong passwords against the same email
# in 15 min ⇒ ACCOUNT_TEMPORARILY_LOCKED on the 6th, even from new IPs.
```

## 12. Backup setup (round 14)

```bash
# Cron the encrypted nightly backup (run as the `lifeos` user).
sudo tee /etc/cron.d/lifeos-backup >/dev/null <<'EOF'
0 2 * * * lifeos cd /opt/lifeos && /opt/lifeos/scripts/backup-db-encrypted.sh >> /var/log/lifeos-backup.log 2>&1
EOF
sudo systemctl restart cron
```

To probe the restore path quarterly: `docs/BACKUP_RESTORE_DRILL.md`.

## 13. Metrics + APM

```bash
# /metrics is gated by METRICS_ENABLED + (optional) bearer token.
curl -s -H "Authorization: Bearer $(grep -E '^METRICS_BEARER_TOKEN=' .env.production | cut -d= -f2-)" \
  http://127.0.0.1:3000/metrics | head -20
```

Configure your Prometheus to scrape `https://api.example.com/metrics` with
the bearer token. See `docs/PRODUCTION_DASHBOARDS.md` for suggested panels.

## 14. Logs (don't leak secrets)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production logs --tail=200 api
```

Verified across rounds 11–14: no log line includes JWT, refresh token,
verification token, reset token, password, AI API key, BYOK encrypted blob,
or finance row contents. The 5xx log lines include only the request id +
method + url + status + errorCode (round-11 fix).

## 15. Rollback

See `scripts/prod-rollback.md` for the full runbook. TL;DR:

```bash
LIFEOS_API_TAG=<previous-tag> \
  docker compose -f docker-compose.production.yml --env-file .env.production \
  up -d --no-deps api
./scripts/prod-smoke-test.sh
```

## 16. Common failures

| Symptom | Likely cause | Fix |
|--|--|--|
| API container won't start, log "Invalid environment variables" | Missing/weak env value | Check the named field; regenerate via `openssl rand` if needed |
| `/health/ready` reports `redis:"disabled"` | `QUEUE_ENABLED=false` in prod | Set `QUEUE_ENABLED=true` and `REDIS_URL=...`; restart api |
| `prisma migrate deploy` fails with shadow DB error | Local migration created with wrong tooling | Run `prisma migrate status` first; resolve via `prisma migrate resolve --rolled-back <name>` (see scripts/prod-migrate.sh log) |
| `BACKUP_ENCRYPTION_KEY must be set` | Backup script run without the env | `BACKUP_ENCRYPTION_KEY=... ./scripts/backup-db-encrypted.sh` |
| Mobile client can't reach API: CORS | `CORS_ORIGIN` doesn't include the exact origin (https + host) | Update `.env.production` and restart api |
| Rate-limited mobile users getting `RATE_LIMITED` from a single device | The new per-user tracker (round 12) | Tune `THROTTLE_LIMIT` upward, OR have the user wait `Retry-After` seconds |
| `ACCOUNT_TEMPORARILY_LOCKED` in support tickets | Round-14 lockout fired | DBA can clear via `UPDATE users SET failed_login_count=0, locked_until=null WHERE id=$1` |
| Verification email not arriving | Default ConsoleEmailProvider — link is in the api log | Wire SMTP (round-15 backlog) or pull the link from `docker compose logs api` |

## 17. Copy-paste shell — full deploy in one block

```bash
# Run on the VPS as the `lifeos` user.
cd /opt/lifeos
git fetch --tags && git checkout v1.4.0
./scripts/prod-deploy.sh
./scripts/prod-smoke-test.sh
echo "deploy done at $(date -u +%FT%TZ)"
```

Promote to production only after the staging rehearsal exits 0 on the
smoke test.
