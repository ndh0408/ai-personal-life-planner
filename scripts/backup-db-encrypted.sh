#!/usr/bin/env bash
# scripts/backup-db-encrypted.sh
#
# Round-14 production backup: pg_dump → gzip → AES-256-CBC encryption (openssl)
# → optional S3-compatible upload. Designed to run from cron on the API host
# OR from a CI job that has read-only DB credentials.
#
# Required env (validated below):
#   DATABASE_URL              postgres://user:pass@host:port/db
#   BACKUP_DIR                local working directory (default /var/lib/lifeos/backups)
#   BACKUP_ENCRYPTION_KEY     symmetric secret (>= 32 chars). Generate via
#                             `openssl rand -hex 32`. Rotate by re-encrypting
#                             old archives — see docs/ENCRYPTED_BACKUPS.md.
#
# Optional env (S3 upload):
#   BACKUP_BUCKET             s3://bucket/path
#   BACKUP_S3_ENDPOINT        e.g. https://s3.us-west-002.backblazeb2.com
#   BACKUP_ACCESS_KEY_ID      provider access key
#   BACKUP_SECRET_ACCESS_KEY  provider secret
#
# Notes:
#   - Never echoes the encryption key or the DB password.
#   - Exit codes: 0 success, 1 misconfig, 2 dump failure, 3 upload failure.
#   - --dry-run prints what would happen without writing the encrypted file.

set -Eeuo pipefail
umask 077

DRY_RUN="false"
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN="true"; fi

log() { printf '[backup] %s\n' "$*" >&2; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL required"
[[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]] || fail "BACKUP_ENCRYPTION_KEY required (>= 32 chars)"
if [[ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]]; then
  fail "BACKUP_ENCRYPTION_KEY must be at least 32 chars"
fi
command -v pg_dump >/dev/null || fail "pg_dump not in PATH"
command -v gzip >/dev/null || fail "gzip not in PATH"
command -v openssl >/dev/null || fail "openssl not in PATH"

BACKUP_DIR="${BACKUP_DIR:-/var/lib/lifeos/backups}"
mkdir -p "$BACKUP_DIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="lifeos-${TS}.sql.gz.enc"
OUT="${BACKUP_DIR}/${BASENAME}"
TMP_PIPE_DUMP="$(mktemp -u)"
trap 'rm -f "$TMP_PIPE_DUMP" "${OUT}.partial" 2>/dev/null || true' EXIT

log "starting backup ts=${TS} → ${BASENAME}"

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] would dump + gzip + encrypt to ${OUT}"
  exit 0
fi

# Stream pg_dump → gzip → openssl enc; never lands plaintext on disk. The key
# is read from env via -pass to keep it off the process arg list.
if ! pg_dump --no-owner --no-acl --format=plain "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass "env:BACKUP_ENCRYPTION_KEY" \
      -out "${OUT}.partial"; then
  rm -f "${OUT}.partial"
  fail "pg_dump pipeline failed" 2
fi
mv "${OUT}.partial" "$OUT"
SIZE="$(stat --printf='%s' "$OUT")"
log "wrote ${OUT} (${SIZE} bytes)"

if [[ -n "${BACKUP_BUCKET:-}" ]]; then
  command -v aws >/dev/null || fail "aws CLI not in PATH (needed for upload)" 3
  log "uploading to ${BACKUP_BUCKET}/${BASENAME}"
  AWS_ACCESS_KEY_ID="${BACKUP_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${BACKUP_SECRET_ACCESS_KEY:-}" \
  aws s3 cp "$OUT" "${BACKUP_BUCKET}/${BASENAME}" \
    ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} \
    --only-show-errors \
    || fail "S3 upload failed" 3
  log "upload OK"
fi

# Round-16 tiered retention. The dedicated prune script promotes today's
# archive into daily/weekly/monthly buckets and trims each bucket
# independently. Falls back to the simple 14-day delete if the script is
# unavailable (e.g. on a stripped-down image).
if [[ -x "$(dirname "$0")/prune-backups.sh" ]]; then
  if BACKUP_DIR="$BACKUP_DIR" "$(dirname "$0")/prune-backups.sh"; then
    # Round-18 marker for backup-metrics-exporter.sh.
    date -u +%s > "$BACKUP_DIR/.last-prune-success"
  else
    log "warn: prune-backups.sh exited non-zero — leaving archives in place"
  fi
else
  find "$BACKUP_DIR" -maxdepth 1 -name 'lifeos-*.sql.gz.enc' -mtime +14 -delete \
    2>/dev/null || true
fi

# Round-18 marker for backup-metrics-exporter.sh. Writes the unix epoch of
# the successful backup. The exporter reads this and emits gauges.
date -u +%s > "$BACKUP_DIR/.last-backup-success"

log "done"
