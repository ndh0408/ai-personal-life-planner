#!/usr/bin/env bash
# scripts/restore-db-encrypted.sh
#
# Restores an encrypted backup produced by backup-db-encrypted.sh.
#
# Usage:
#   ./scripts/restore-db-encrypted.sh <path-to-.sql.gz.enc>
#
# Required env:
#   DATABASE_URL              target database (will be REPLACED)
#   BACKUP_ENCRYPTION_KEY     same key used to encrypt
#
# Safety: refuses to run if DATABASE_URL contains the substring `prod` UNLESS
# `--i-know-this-is-production` is passed AND the operator types the literal
# string YES at the prompt. This is intentionally heavy-handed.

set -Eeuo pipefail
umask 077

log() { printf '[restore] %s\n' "$*" >&2; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

ARCHIVE="${1:-}"
[[ -n "$ARCHIVE" ]] || fail "usage: $0 <path-to-.sql.gz.enc> [--i-know-this-is-production]"
[[ -f "$ARCHIVE" ]] || fail "archive not found: $ARCHIVE"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL required"
[[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]] || fail "BACKUP_ENCRYPTION_KEY required"
command -v psql >/dev/null || fail "psql not in PATH"
command -v openssl >/dev/null || fail "openssl not in PATH"
command -v gunzip >/dev/null || fail "gunzip not in PATH"

ALLOW_PROD="false"
shift || true
for arg in "$@"; do
  if [[ "$arg" == "--i-know-this-is-production" ]]; then ALLOW_PROD="true"; fi
done

if [[ "$DATABASE_URL" == *prod* ]]; then
  if [[ "$ALLOW_PROD" != "true" ]]; then
    fail "DATABASE_URL looks like production. Pass --i-know-this-is-production to override"
  fi
  printf 'About to restore over a PRODUCTION-looking database.\nType YES to continue: '
  read -r CONFIRM
  if [[ "$CONFIRM" != "YES" ]]; then fail "aborted"; fi
fi

log "decrypting + restoring from ${ARCHIVE}"

# Decrypt → gunzip → psql. The plaintext SQL is streamed straight into psql
# so it never lands on disk.
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
      -pass "env:BACKUP_ENCRYPTION_KEY" -in "$ARCHIVE" \
      | gunzip \
      | psql "$DATABASE_URL"; then
  fail "restore pipeline failed" 2
fi

log "done"
