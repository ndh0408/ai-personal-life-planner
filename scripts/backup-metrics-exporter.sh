#!/usr/bin/env bash
# scripts/backup-metrics-exporter.sh — emit Prometheus textfile-collector
# output for backup + WAL + restore-verify state.
#
# Reads marker files dropped by:
#   - backup-db-encrypted.sh        → $BACKUP_DIR/.last-backup-success
#   - backup-db-encrypted.sh        → $BACKUP_DIR/.last-prune-success
#   - archive-wal.sh                → $WAL_ARCHIVE_DIR/.last-wal-archive-success
#   - restore-verify.sh             → $VERIFY_MARKER_DIR/.last-backup-verify-success
#
# Writes a single .prom file in TEXTFILE_DIR (default /var/lib/node_exporter
# /textfile_collector — node_exporter's default scrape directory).
#
# Usage from cron (every 60s):
#   * * * * * lifeos /opt/lifeos/scripts/backup-metrics-exporter.sh
#
# All metric names match those declared in
# apps/api/src/modules/observability/metrics.registry.ts so the operator
# can drop these into the same Grafana dashboards.
#
# This script does NOT read the encrypted backup contents and does NOT need
# the encryption key. It only reads timestamps from marker files.

set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/lib/lifeos/backups}"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/lifeos/wal-archive}"
VERIFY_MARKER_DIR="${VERIFY_MARKER_DIR:-/var/lib/lifeos/backups}"
TEXTFILE_DIR="${TEXTFILE_DIR:-/var/lib/node_exporter/textfile_collector}"

mkdir -p "$TEXTFILE_DIR"
TMP="$(mktemp -p "$TEXTFILE_DIR" lifeos-backup.XXXXXX.prom)"
trap 'rm -f "$TMP"' EXIT

NOW="$(date -u +%s)"

# Read a marker file and emit gauge + age. Missing marker → emit 0 so the
# `_age_seconds` gauge will report a very large number (Prometheus
# `time() - 0` ≈ epoch), making "never seen" loudly visible.
emit_marker() {
  local label="$1" file="$2"
  local ts="0"
  [[ -f "$file" ]] && ts="$(cat "$file" 2>/dev/null || echo 0)"
  [[ "$ts" =~ ^[0-9]+$ ]] || ts="0"
  case "$label" in
    backup)
      printf 'lifeos_backup_last_success_timestamp_seconds %s\n' "$ts" >>"$TMP"
      [[ "$ts" -gt 0 ]] \
        && printf 'lifeos_backup_age_seconds %s\n' "$((NOW - ts))" >>"$TMP" \
        || printf 'lifeos_backup_age_seconds %s\n' "$NOW" >>"$TMP"
      ;;
    backup_verify)
      printf 'lifeos_backup_verify_last_success_timestamp_seconds %s\n' "$ts" >>"$TMP"
      [[ "$ts" -gt 0 ]] \
        && printf 'lifeos_backup_verify_age_seconds %s\n' "$((NOW - ts))" >>"$TMP" \
        || printf 'lifeos_backup_verify_age_seconds %s\n' "$NOW" >>"$TMP"
      ;;
    backup_prune)
      printf 'lifeos_backup_prune_last_success_timestamp_seconds %s\n' "$ts" >>"$TMP"
      ;;
    wal_archive)
      printf 'lifeos_wal_archive_last_success_timestamp_seconds %s\n' "$ts" >>"$TMP"
      [[ "$ts" -gt 0 ]] \
        && printf 'lifeos_wal_archive_stale_seconds %s\n' "$((NOW - ts))" >>"$TMP" \
        || printf 'lifeos_wal_archive_stale_seconds %s\n' "$NOW" >>"$TMP"
      ;;
  esac
}

# WAL backlog = .enc files without a matching .ok marker (matches the
# wal-archive-healthcheck.sh logic).
wal_backlog() {
  local n=0
  shopt -s nullglob
  for f in "$WAL_ARCHIVE_DIR"/*.enc; do
    [[ -f "${f}.ok" ]] || n=$((n + 1))
  done
  shopt -u nullglob
  printf 'lifeos_wal_archive_backlog_count %s\n' "$n" >>"$TMP"
}

{
  printf '# HELP lifeos_backup_age_seconds Seconds since last successful encrypted backup\n'
  printf '# TYPE lifeos_backup_age_seconds gauge\n'
  printf '# HELP lifeos_wal_archive_stale_seconds Seconds since last successful WAL archive\n'
  printf '# TYPE lifeos_wal_archive_stale_seconds gauge\n'
  printf '# HELP lifeos_wal_archive_backlog_count Encrypted WAL segments without .ok marker\n'
  printf '# TYPE lifeos_wal_archive_backlog_count gauge\n'
} >>"$TMP"

emit_marker backup        "$BACKUP_DIR/.last-backup-success"
emit_marker backup_verify "$VERIFY_MARKER_DIR/.last-backup-verify-success"
emit_marker backup_prune  "$BACKUP_DIR/.last-prune-success"
emit_marker wal_archive   "$WAL_ARCHIVE_DIR/.last-wal-archive-success"
wal_backlog

# Atomic publish — node_exporter watches the directory; partial writes
# would be picked up briefly without rename.
mv "$TMP" "$TEXTFILE_DIR/lifeos-backup.prom"
trap - EXIT
