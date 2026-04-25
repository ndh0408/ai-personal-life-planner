#!/usr/bin/env bash
# scripts/wal-archive-healthcheck.sh — alert on stale or failed WAL archive.
#
# Runs from cron / monitoring; exits non-zero when:
#   - the spool directory has no .enc file newer than MAX_AGE_MINUTES
#   - the spool directory has more than ALERT_BACKLOG segments without .ok
#   - disk usage on the spool mount is above DISK_WARN_PERCENT
#
# Designed to be cheap (filesystem stats only, no openssl). Pair with a
# nagios/prometheus exporter that reads the exit code.
#
# Required env:
#   WAL_ARCHIVE_DIR             default /var/lib/lifeos/wal-archive
#
# Optional env:
#   MAX_AGE_MINUTES             default 10 (production target)
#   ALERT_BACKLOG               default 50
#   DISK_WARN_PERCENT           default 85
#
# Exit codes:
#   0  healthy
#   1  stale (no fresh segment)
#   2  backlog (uploads failing)
#   3  disk pressure
#   4  misconfig

set -Eeuo pipefail

WAL_DIR="${WAL_ARCHIVE_DIR:-/var/lib/lifeos/wal-archive}"
MAX_AGE_MIN="${MAX_AGE_MINUTES:-10}"
ALERT_BACKLOG="${ALERT_BACKLOG:-50}"
DISK_WARN_PCT="${DISK_WARN_PERCENT:-85}"

log() { printf '[wal-health] %s\n' "$*"; }

[[ -d "$WAL_DIR" ]] || { log "ERROR: WAL_ARCHIVE_DIR missing: $WAL_DIR"; exit 4; }

# 1. Freshness — newest .enc file age vs MAX_AGE_MINUTES.
NEWEST_AGE_MIN="$(find "$WAL_DIR" -maxdepth 1 -name '*.enc' -printf '%T@\n' 2>/dev/null \
  | sort -nr | head -1 \
  | awk -v now="$(date +%s)" '{ if (NF==0) exit 1; printf "%d", (now - $1) / 60 }')"
if [[ -z "$NEWEST_AGE_MIN" ]]; then
  log "FAIL stale: no .enc files in $WAL_DIR"
  exit 1
fi
if [[ "$NEWEST_AGE_MIN" -gt "$MAX_AGE_MIN" ]]; then
  log "FAIL stale: newest WAL is ${NEWEST_AGE_MIN} min old (> ${MAX_AGE_MIN})"
  exit 1
fi

# 2. Backlog — segments missing their .ok marker mean upload kept failing.
BACKLOG=0
shopt -s nullglob
for f in "$WAL_DIR"/*.enc; do
  [[ -f "${f}.ok" ]] || BACKLOG=$((BACKLOG + 1))
done
shopt -u nullglob
if [[ "$BACKLOG" -gt "$ALERT_BACKLOG" ]]; then
  log "FAIL backlog: ${BACKLOG} segments without .ok (limit ${ALERT_BACKLOG})"
  exit 2
fi

# 3. Disk pressure on the spool mount.
PCT="$(df -P "$WAL_DIR" | awk 'NR==2 { sub(/%/,"",$5); print $5 }')"
if [[ -n "$PCT" && "$PCT" -ge "$DISK_WARN_PCT" ]]; then
  log "FAIL disk: spool mount at ${PCT}% (warn at ${DISK_WARN_PCT}%)"
  exit 3
fi

log "OK newest=${NEWEST_AGE_MIN}min backlog=${BACKLOG} disk=${PCT}%"
exit 0
