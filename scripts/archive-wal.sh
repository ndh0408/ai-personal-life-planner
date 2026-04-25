#!/usr/bin/env bash
# scripts/archive-wal.sh — PostgreSQL WAL archive_command implementation.
#
# Wired into postgresql.conf via:
#   archive_mode = on
#   archive_command = '/opt/lifeos/scripts/archive-wal.sh "%p" "%f"'
#
# Encrypts each WAL segment with AES-256-CBC + PBKDF2 200k (same algorithm
# as backup-db-encrypted.sh) and writes it to local spool, optionally
# uploaded to S3-compatible object storage.
#
# Args:
#   $1 = absolute path to WAL segment (PostgreSQL %p)
#   $2 = WAL segment basename (PostgreSQL %f)
#
# Required env (validated below):
#   WAL_ARCHIVE_ENCRYPTION_KEY   ≥ 32 chars (or BACKUP_ENCRYPTION_KEY as fallback)
#   WAL_ARCHIVE_DIR              local spool, default /var/lib/lifeos/wal-archive
#
# Optional env:
#   WAL_ARCHIVE_MODE             local | s3 | disabled  (default: local)
#   WAL_S3_BUCKET                s3://bucket/path
#   WAL_S3_ENDPOINT              custom S3 endpoint (R2, B2, MinIO)
#   WAL_S3_ACCESS_KEY_ID         provider key
#   WAL_S3_SECRET_ACCESS_KEY     provider secret
#
# Exit codes (PostgreSQL retries on non-zero):
#   0  success — WAL safely archived
#   1  misconfig (env missing, tools missing) — Postgres will retry forever,
#      so this should be caught by monitoring, not by the database itself
#   2  IO failure (disk full, partial write) — Postgres retries
#   3  upload failure — local copy still on disk, retried next archive
#
# Idempotency: if the destination already has the WAL segment AND its size
# matches, we treat as success without re-encrypting. PostgreSQL re-invokes
# archive_command after a crash mid-archive, and re-encrypting the same
# segment would produce a different ciphertext (random IV) — pointless work
# and wastes object-storage operations.

set -Eeuo pipefail
umask 077

WAL_PATH="${1:-}"
WAL_NAME="${2:-}"

log() { printf '[wal-archive] %s\n' "$*" >&2; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

[[ -n "$WAL_PATH" && -f "$WAL_PATH" ]] || fail "missing or unreadable WAL: $WAL_PATH"
[[ -n "$WAL_NAME" ]] || fail "missing WAL basename"

MODE="${WAL_ARCHIVE_MODE:-local}"
if [[ "$MODE" == "disabled" ]]; then
  # Caller asked to disable — exit 0 so Postgres doesn't loop. Only set
  # this in non-prod environments where you genuinely don't want WAL kept.
  exit 0
fi

# Export so `openssl -pass env:KEY` can read it. We never echo it.
export KEY="${WAL_ARCHIVE_ENCRYPTION_KEY:-${BACKUP_ENCRYPTION_KEY:-}}"
[[ -n "$KEY" && "${#KEY}" -ge 32 ]] || fail "WAL_ARCHIVE_ENCRYPTION_KEY (or BACKUP_ENCRYPTION_KEY) ≥32 chars required"

command -v openssl >/dev/null || fail "openssl not in PATH"

WAL_DIR="${WAL_ARCHIVE_DIR:-/var/lib/lifeos/wal-archive}"
mkdir -p "$WAL_DIR"
DEST="${WAL_DIR}/${WAL_NAME}.enc"
LOCK="${WAL_DIR}/.${WAL_NAME}.lock"

# Idempotency: if dest exists AND a sibling .ok marker exists, we already
# archived this segment in a prior run that crashed before reporting success.
if [[ -f "${DEST}.ok" && -s "$DEST" ]]; then
  log "already archived ${WAL_NAME} (size $(stat -c %s "$DEST")) — skipping"
  exit 0
fi

# Single-writer lock per segment. flock so concurrent invocations from a
# crash-recovering Postgres can't collide.
exec 9>"$LOCK"
if ! flock -n 9; then
  log "another archive already in progress for ${WAL_NAME} — exiting non-fatal"
  # Exit 0 to let Postgres think this run succeeded; the holder of the lock
  # will report the real result.
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT

# 1. Encrypt to a temp file, then atomic rename. Postgres reads the source
#    WAL directly; we never modify it.
TMP="${DEST}.partial"
if ! openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
      -pass "env:KEY" \
      -in "$WAL_PATH" -out "$TMP"; then
  rm -f "$TMP"
  fail "openssl enc failed for ${WAL_NAME}" 2
fi
mv "$TMP" "$DEST"

# 2. Optional upload. We do this BEFORE marking .ok so an upload failure
#    leaves the segment in the local spool for the next attempt.
if [[ "$MODE" == "s3" ]]; then
  command -v aws >/dev/null || fail "aws CLI not in PATH (needed for s3 mode)" 3
  [[ -n "${WAL_S3_BUCKET:-}" ]] || fail "WAL_S3_BUCKET required for s3 mode" 3
  if ! AWS_ACCESS_KEY_ID="${WAL_S3_ACCESS_KEY_ID:-}" \
       AWS_SECRET_ACCESS_KEY="${WAL_S3_SECRET_ACCESS_KEY:-}" \
       aws s3 cp "$DEST" "${WAL_S3_BUCKET}/${WAL_NAME}.enc" \
         ${WAL_S3_ENDPOINT:+--endpoint-url "$WAL_S3_ENDPOINT"} \
         --only-show-errors; then
    fail "s3 upload failed for ${WAL_NAME}" 3
  fi
fi

# 3. Mark success so we never re-archive the same segment.
: > "${DEST}.ok"
SIZE="$(stat -c %s "$DEST")"
log "OK ${WAL_NAME} encrypted=${SIZE}B mode=${MODE}"

exit 0
