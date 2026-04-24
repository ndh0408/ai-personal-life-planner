# Deploy — LifeOS AI backend (production)

Self-hosted single-VPS deploy using Docker Compose. The stack is three containers: `postgres`, `redis` (reserved for future job queue), and `api` (NestJS + Prisma). The API binds to `127.0.0.1:3000` only — traffic reaches it via Nginx or Cloudflare Tunnel.

## 1. Prepare the VPS

Minimum specs for a small install:
- 1 vCPU, 2 GB RAM, 20 GB SSD.
- Ubuntu 22.04+ or Debian 12+ (other distros work; commands below are apt-based).
- A DNS A record pointing at the VPS (e.g. `api.yourdomain.com`).
- Ports 22 / 80 / 443 open; 3000 / 5432 / 6379 **closed** to the internet.

```bash
sudo apt update
sudo apt install -y git ca-certificates curl gnupg ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 2. Install Docker + Compose v2

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker          # or log out + back in
docker compose version # should report v2.x
```

## 3. Fetch the repository

```bash
cd /opt
sudo mkdir -p lifeos && sudo chown "$USER" lifeos && cd lifeos
git clone git@github.com:ndh0408/ai-personal-life-planner.git app
cd app
```

## 4. Create the production env file

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:

| Var | Notes |
| --- | --- |
| `POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD` | Match `DATABASE_URL`. Password ≥ 24 random chars. |
| `DATABASE_URL` | `postgresql://<user>:<pass>@postgres:5432/<db>?schema=public`. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Two independent secrets, ≥ 32 chars. Generate: `openssl rand -base64 48`. |
| `AI_PROVIDER` | `mock` / `anthropic` / `openai`. |
| `AI_API_KEY` | Only ever lives here. **Never in the mobile bundle.** |
| `CORS_ORIGINS` | Comma-separated list of trusted origins. |
| `DEFAULT_LOCALE` | `vi`. |
| `SUPPORTED_LOCALES` | `vi,en`. |

**What never goes here**: Anthropic/OpenAI keys from the mobile repo, personal access tokens, SSH keys. Those belong in a secrets manager. `logs` below also never prints env values.

## 5. First-time bring-up

```bash
# Start postgres + redis + build + start api, then run migrations.
./scripts/deploy.sh
```

`deploy.sh` in order:
1. Pulls the latest `postgres` / `redis` base images.
2. Builds the `lifeos-api:${LIFEOS_API_TAG:-latest}` image from `apps/api/Dockerfile`.
3. Brings up postgres + redis, waits until `pg_isready`.
4. Runs `prisma migrate deploy` via `./scripts/migrate.sh`.
5. Starts (or restarts) the `api` container.
6. Polls `http://127.0.0.1:3000/api/health` for up to 60 s; exits non-zero if it never goes 200.

## 6. Health check

```bash
curl -fsS http://127.0.0.1:3000/api/health
# {"success":true,"data":{"status":"ok","service":"planner-api","timestamp":"…"}, …}
```

Dockered healthcheck also runs every 30 s inside the container (`HEALTHCHECK` in the Dockerfile). Compose surfaces the status via `docker compose ps`.

## 7. Domain + HTTPS

Two battle-tested options. Pick one.

### Option A — Nginx + Let's Encrypt (full control)

Install:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/api.yourdomain.com`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS — certbot inserts the 443 block + cert lines below.
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # Hand off request-id so logs correlate client + server.
    proxy_set_header X-Request-Id $request_id;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;

    client_max_body_size 5m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }
}
```

Enable + renew:
```bash
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot's cron/`systemd-timer` handles renewals automatically.

### Option B — Cloudflare Tunnel (no inbound ports)

No need to open 80/443 on the VPS. Cloudflare terminates TLS; Tunnel proxies over an outbound connection.

```bash
# Install
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# Auth + create tunnel
cloudflared tunnel login
cloudflared tunnel create lifeos-api
cloudflared tunnel route dns lifeos-api api.yourdomain.com

# /etc/cloudflared/config.yml
sudo tee /etc/cloudflared/config.yml <<'YAML'
tunnel: lifeos-api
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: api.yourdomain.com
    service: http://127.0.0.1:3000
  - service: http_status:404
YAML

sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Keep `ufw` closed on 80/443 in this mode.

## 8. Backups

Dump is run by `./scripts/backup-db.sh`; writes `./backups/lifeos-<ISO>.sql.gz` and prunes to the last 14 by default.

Schedule nightly at 03:00 via cron:
```cron
0 3 * * * cd /opt/lifeos/app && ./scripts/backup-db.sh >> /var/log/lifeos-backup.log 2>&1
```

For off-box redundancy, add a step that copies the latest file to S3/Backblaze/rsync target:
```cron
15 3 * * * rclone copy /opt/lifeos/app/backups/ remote:lifeos-backups/ --include "lifeos-*.sql.gz" --no-traverse
```

Never back up the env file to cloud storage unless that storage is encrypted + access-controlled.

## 9. Restore

```bash
# Warning: drops + recreates tables — API is stopped automatically.
CONFIRM=yes ./scripts/restore-db.sh ./backups/lifeos-20260425T030000Z.sql.gz
```

The script also re-runs `prisma migrate deploy` afterward so a restored snapshot from an older schema version advances to the current migration set.

## 10. Update to a new version

```bash
cd /opt/lifeos/app
git fetch --tags
git checkout v1.2.0
LIFEOS_API_TAG=v1.2.0 ./scripts/deploy.sh
```

The api container is rebuilt, migrated, and restarted. Postgres + Redis keep running.

## 11. Rollback

Simplest: redeploy the previous tag.

```bash
git checkout v1.1.0
LIFEOS_API_TAG=v1.1.0 ./scripts/deploy.sh
```

If the new version introduced a non-backwards-compatible migration, restore the pre-deploy backup first:
```bash
# 1. Take a fresh snapshot (keeps the *current* broken state for forensics)
./scripts/backup-db.sh
# 2. Restore the good snapshot
CONFIRM=yes ./scripts/restore-db.sh ./backups/lifeos-<pre-deploy>.sql.gz
# 3. Deploy the old tag
git checkout v1.1.0
LIFEOS_API_TAG=v1.1.0 ./scripts/deploy.sh
```

A one-tag-rollback policy + backups at each deploy is the minimum; for stricter SLAs wire up blue/green with two compose projects and an Nginx upstream switch.

## 12. Observability essentials

- **Logs**: `docker compose -f docker-compose.production.yml --env-file .env.production logs -f api`. Compose tags each line with the container name; Nest writes to stdout/stderr, so the json-file driver handles rotation (`max-size: 20m, max-file: 5`). Secrets never print — the ConfigModule's schema validates on boot and errors only mention which var failed, never its value.
- **Metrics**: `docker stats` for quick per-container CPU/RAM; for real production, point a Prometheus node-exporter at the VPS + scrape `/api/health/ready` for liveness.
- **Alerts**: at minimum, a UptimeRobot / Checkly monitor against `https://api.yourdomain.com/api/health` every minute.

## 13. Security checklist

- [ ] Firewall (`ufw`) allows only 22 + 80 + 443 (or nothing for Tunnel mode).
- [ ] `.env.production` is 600 perms, not in any backup destination without encryption.
- [ ] Postgres password ≥ 24 chars, random.
- [ ] JWT secrets rotated every ~90 days (bumps the access secret invalidates active tokens; rotate refresh secret during a planned window).
- [ ] `AI_API_KEY` exists only on the server. Verify the mobile bundle:
  ```bash
  grep -rn "ANTHROPIC_API_KEY\|OPENAI_API_KEY\|JWT_SECRET\|DATABASE_URL" apps/mobile/src || echo "clean"
  ```
- [ ] `CORS_ORIGINS` lists only the production mobile + web origins you actually own.
- [ ] TLS is HTTPS-only — Nginx redirects 80 → 443; mobile app refuses `http://` in production (see `app.config.ts`).
- [ ] Backups rehearsed: pick a random backup once a quarter and restore it into a scratch VPS to confirm it works.

## 14. Common issues

**Build fails: `Could not find a declaration file for module '@planner/shared'`**
→ A stale `tsconfig.tsbuildinfo` got copied into the image. Fixed in the Dockerfile by scrubbing all `*.tsbuildinfo` + `dist/` before running the shared build. If it recurs, `docker build --no-cache`.

**Runtime: `libssl.so.1.1: No such file`**
→ Alpine uses OpenSSL 3. Prisma needs `linux-musl-openssl-3.0.x` in `binaryTargets` in `schema.prisma` (already set). The runtime image installs `openssl` + `libssl3`. Re-run `prisma generate` if you ever add a new Prisma version.

**`Invalid environment variables: JWT_ACCESS_SECRET must be at least 32 chars`**
→ Generate proper secrets: `openssl rand -base64 48`.

**Health endpoint 502 via Nginx**
→ API crashed; check `docker compose logs api`. Nginx's upstream can't reach `127.0.0.1:3000` if Compose is binding to a non-default address.

**Migrations fail: `relation ... already exists`**
→ Someone ran `prisma db push` in prod or the `_prisma_migrations` table is missing. Fix by restoring the most recent backup then running `./scripts/migrate.sh`. Never run `db push` in production.

## 15. Quick reference

```bash
# Start everything
./scripts/deploy.sh

# Migrate only
./scripts/migrate.sh

# Tail api logs
docker compose -f docker-compose.production.yml --env-file .env.production logs -f api

# Shell into api
docker compose -f docker-compose.production.yml --env-file .env.production exec api sh

# Backup / restore
./scripts/backup-db.sh
CONFIRM=yes ./scripts/restore-db.sh ./backups/lifeos-<ts>.sql.gz

# Stop (keeps volumes)
docker compose -f docker-compose.production.yml --env-file .env.production down

# Full wipe (destroys data — only in dev)
docker compose -f docker-compose.production.yml --env-file .env.production down -v
```
