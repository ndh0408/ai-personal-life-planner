#!/usr/bin/env bash
# scripts/prod-migrate.sh — apply pending Prisma migrations on production.
#
# Idempotent: `prisma migrate deploy` only runs migrations that haven't
# already been applied. Safe to invoke multiple times.
#
# Usage:
#   ./scripts/prod-migrate.sh
#
# Prerequisites:
#   - .env.production exists.
#   - The postgres container is running and healthy.
#
# Notes:
#   - Runs in a disposable container so the running api process is not
#     interrupted while the migration applies.
#   - DOES NOT seed. The seed script refuses to run with NODE_ENV=production
#     unless ALLOW_SEED_IN_PRODUCTION=true is explicitly set (see seed.ts).
#   - Captures the migration history before + after so an operator has a
#     before/after snapshot for the change-log.

set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"

log() { printf '[prod-migrate] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

[[ -f .env.production ]] || fail "missing .env.production"

if ! $COMPOSE ps -q postgres >/dev/null 2>&1; then
  fail "postgres container is not running. Start it: docker compose ... up -d postgres"
fi

log "current migration status (before):"
$COMPOSE run --rm --no-deps --entrypoint "" \
  api sh -c 'cd apps/api && npx prisma migrate status' || true

log "applying pending migrations…"
$COMPOSE run --rm --no-deps --entrypoint "" \
  api sh -c 'cd apps/api && npx prisma migrate deploy'

log "migration status (after):"
$COMPOSE run --rm --no-deps --entrypoint "" \
  api sh -c 'cd apps/api && npx prisma migrate status' || true

log "done."
