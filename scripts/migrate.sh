#!/usr/bin/env bash
# Run Prisma migrations inside the api container.
# Idempotent: `prisma migrate deploy` only applies pending migrations.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"

if ! $COMPOSE ps -q postgres >/dev/null 2>&1; then
  echo "[migrate] Postgres container not running. Start it first: docker compose up -d postgres" >&2
  exit 2
fi

# Run migrations via a disposable container that uses the same image as the
# api, so the Prisma binary matches what the running service expects.
$COMPOSE run --rm --no-deps \
  --entrypoint "" \
  api sh -c 'cd apps/api && npx prisma migrate deploy'
