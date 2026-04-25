#!/usr/bin/env bash
# scripts/prod-deploy.sh — round-15 production deploy.
#
# Usage:
#   ./scripts/prod-deploy.sh                      # deploy api only
#   ./scripts/prod-deploy.sh --with-worker        # also (re)deploy the worker container
#   LIFEOS_API_TAG=v1.4.0 ./scripts/prod-deploy.sh
#
# Steps:
#   1. Validate .env.production (round-12 + round-14 keys)
#   2. Build the new api image (tagged + previous-tag preserved for rollback)
#   3. Bring postgres + redis up if needed
#   4. Run prisma migrate deploy via a disposable container
#   5. Restart the api container — never touches postgres/redis volumes
#   6. Wait for /api/health/ready (DB + Redis + queues OK)
#   7. (optional) recreate the worker container
#
# Safety:
#   - Refuses to run if .env.production is missing.
#   - Stops on first error (set -e).
#   - Never logs the contents of .env.production.
#   - Captures the previous image tag in PREV_TAG so prod-rollback.md can
#     point you at the exact image to flip back to.

set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

WITH_WORKER="false"
for arg in "$@"; do
  if [[ "$arg" == "--with-worker" ]]; then WITH_WORKER="true"; fi
done

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"
TAG="${LIFEOS_API_TAG:-latest}"

log() { printf '[prod-deploy] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

[[ -f .env.production ]] || fail "missing .env.production (copy .env.production.example)"

# Required-key validation. We grep for the LHS only so we never echo values.
required=(
  POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD
  DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET
  AI_PROVIDER_ENCRYPTION_KEY CORS_ORIGIN APP_PUBLIC_URL
)
missing=()
for k in "${required[@]}"; do
  if ! grep -qE "^${k}=.+" .env.production; then missing+=("$k"); fi
done
if [[ ${#missing[@]} -gt 0 ]]; then
  fail ".env.production is missing required keys: ${missing[*]}"
fi

# Capture previous image tag (if any) for rollback. This is NOT a secret.
PREV_TAG="$(docker inspect --format '{{ index .Config.Image }}' lifeos-api 2>/dev/null || true)"
log "previous image: ${PREV_TAG:-<none>}"

log "pulling base images (postgres / redis)…"
$COMPOSE pull postgres redis || true

log "building api:${TAG}…"
LIFEOS_API_TAG="$TAG" $COMPOSE build api

log "ensuring postgres + redis are up…"
$COMPOSE up -d postgres redis

log "waiting for postgres healthy (max 60s)…"
for _ in {1..30}; do
  if $COMPOSE exec -T postgres pg_isready -U "$(grep -E '^POSTGRES_USER=' .env.production | cut -d= -f2-)" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "running prisma migrate deploy…"
./scripts/prod-migrate.sh

log "restarting api container with tag=${TAG}…"
LIFEOS_API_TAG="$TAG" $COMPOSE up -d --no-deps api

if [[ "$WITH_WORKER" == "true" ]]; then
  log "restarting worker container (profile=worker)…"
  LIFEOS_API_TAG="$TAG" $COMPOSE --profile worker up -d --no-deps worker
fi

log "waiting for /api/health/ready (max 60s)…"
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/api/health/ready >/dev/null; then
    log "OK — api is ready."
    log "next: ./scripts/prod-smoke-test.sh"
    log "rollback: see scripts/prod-rollback.md (previous image: ${PREV_TAG:-<none>})"
    exit 0
  fi
  sleep 2
done

log "api did NOT become ready in 60s. Last 200 lines of logs:"
$COMPOSE logs --tail=200 api >&2
exit 1
