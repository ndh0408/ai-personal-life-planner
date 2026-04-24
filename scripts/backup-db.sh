#!/usr/bin/env bash
# Timestamped pg_dump of the production database.
# Writes .sql.gz under ./backups/. Keeps last 14 snapshots by default.
#
# Usage:
#   ./scripts/backup-db.sh                    # dump + prune
#   KEEP=7 ./scripts/backup-db.sh             # keep only 7 most recent
#   OUTDIR=/var/backups/lifeos ./scripts/backup-db.sh

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

if [[ ! -f .env.production ]]; then
  echo "[backup] .env.production not found." >&2
  exit 2
fi

# Read creds without ever echoing them.
set -a
# shellcheck disable=SC1091
source .env.production
set +a

OUTDIR="${OUTDIR:-$HERE/backups}"
KEEP="${KEEP:-14}"
mkdir -p "$OUTDIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUTDIR/lifeos-${TS}.sql.gz"

echo "[backup] Dumping ${POSTGRES_DB} → ${FILE}"

docker compose -f docker-compose.production.yml --env-file .env.production \
  exec -T postgres pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$FILE"

# Quick sanity check.
if [[ ! -s "$FILE" ]]; then
  echo "[backup] Produced file is empty — aborting." >&2
  rm -f "$FILE"
  exit 1
fi

echo "[backup] Wrote $(du -h "$FILE" | cut -f1) ($FILE)"

# Prune — keep the newest $KEEP files.
mapfile -t OLD < <(ls -1t "$OUTDIR"/lifeos-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))")
if (( ${#OLD[@]} > 0 )); then
  echo "[backup] Pruning $(echo "${#OLD[@]}") old snapshot(s)…"
  rm -f "${OLD[@]}"
fi

echo "[backup] Done."
