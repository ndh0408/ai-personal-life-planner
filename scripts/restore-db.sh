#!/usr/bin/env bash
# Restore a Postgres dump produced by backup-db.sh.
#
# Usage:
#   ./scripts/restore-db.sh ./backups/lifeos-20260425T040000Z.sql.gz
#
# Safety:
#   - Refuses to run unless CONFIRM=yes is set, because restore is destructive
#     (the dump uses --clean --if-exists, so existing tables are dropped).
#   - Suggests stopping the API first so migrations / writes don't race.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <path/to/lifeos-*.sql.gz>" >&2
  exit 2
fi

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "[restore] This will DROP + RECREATE tables in the production database."
  echo "[restore] Re-run with CONFIRM=yes $0 $FILE to proceed."
  exit 2
fi

if [[ ! -f .env.production ]]; then
  echo "[restore] .env.production not found." >&2
  exit 2
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"

echo "[restore] Stopping api so no writes race the restore…"
$COMPOSE stop api || true

echo "[restore] Restoring $FILE …"
gunzip -c "$FILE" | $COMPOSE exec -T postgres psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1

echo "[restore] Re-running migrations (idempotent)…"
./scripts/migrate.sh

echo "[restore] Starting api…"
$COMPOSE up -d api

echo "[restore] Done."
