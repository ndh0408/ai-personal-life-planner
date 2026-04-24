#!/usr/bin/env bash
# Deploy the LifeOS API to the current host.
#
# Usage:
#   ./scripts/deploy.sh             # build + migrate + restart api
#   LIFEOS_API_TAG=v1.2.0 ./scripts/deploy.sh   # tag the built image
#
# Assumes:
#   - Running from the repo root on the VPS.
#   - `.env.production` exists next to docker-compose.production.yml.
#   - Docker + Docker Compose v2 installed.
#
# Never logs secret values. If a step fails, the script exits non-zero so an
# outer CI can mark the deploy failed.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"
TAG="${LIFEOS_API_TAG:-latest}"

if [[ ! -f .env.production ]]; then
  echo "[deploy] .env.production not found. Copy from .env.production.example first." >&2
  exit 2
fi

echo "[deploy] Pulling latest base images…"
$COMPOSE pull postgres redis || true

echo "[deploy] Building api:${TAG}…"
LIFEOS_API_TAG="$TAG" $COMPOSE build api

echo "[deploy] Ensuring postgres + redis are up…"
$COMPOSE up -d postgres redis

echo "[deploy] Waiting for postgres healthy…"
for i in {1..30}; do
  if $COMPOSE exec -T postgres pg_isready -U "$(grep -E '^POSTGRES_USER=' .env.production | cut -d= -f2-)" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[deploy] Running Prisma migrations (deploy)…"
./scripts/migrate.sh

echo "[deploy] Restarting api container…"
LIFEOS_API_TAG="$TAG" $COMPOSE up -d --no-deps api

echo "[deploy] Waiting for /api/health…"
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo "[deploy] OK — api is healthy."
    exit 0
  fi
  sleep 2
done

echo "[deploy] api did not become healthy in 60 s — check logs:" >&2
$COMPOSE logs --tail=200 api >&2
exit 1
