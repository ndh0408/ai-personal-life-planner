#!/usr/bin/env bash
# scripts/prune-backups.sh — tiered retention for encrypted DB backups.
#
# Round-16 retention policy:
#   - Daily   : keep last 14 days (≈ 14 archives if you back up nightly)
#   - Weekly  : keep one snapshot per ISO week for the last 8 weeks
#   - Monthly : keep one snapshot per calendar month for the last 12 months
#
# A snapshot can be promoted into multiple buckets (today's archive is also
# this week's + this month's representative). The script tags each archive
# with the bucket(s) it survives via hardlinks so off-box uploaders can pick
# only the rolled-up tier they want.
#
# Usage:
#   ./scripts/prune-backups.sh                    # apply policy in-place
#   ./scripts/prune-backups.sh --dry-run          # report what WOULD be pruned
#   BACKUP_DIR=/var/lib/lifeos/backups ./scripts/prune-backups.sh
#
# Filename convention (set by backup-db-encrypted.sh):
#   lifeos-YYYYMMDDTHHMMSSZ.sql.gz.enc
#
# Notes:
#   - We never delete an archive that hasn't been replaced by a newer one in
#     its bucket. If the cron failed for a week, the existing archive sticks.
#   - Hardlinks live in $BACKUP_DIR/{daily,weekly,monthly}/. Removing a hardlink
#     never destroys the underlying file.

set -Eeuo pipefail
umask 077

DRY_RUN="false"
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="true"

BACKUP_DIR="${BACKUP_DIR:-/var/lib/lifeos/backups}"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"

DAILY_KEEP="${DAILY_KEEP:-14}"
WEEKLY_KEEP="${WEEKLY_KEEP:-8}"
MONTHLY_KEEP="${MONTHLY_KEEP:-12}"

log() { printf '[prune] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit "${2:-1}"; }

[[ -d "$BACKUP_DIR" ]] || fail "BACKUP_DIR does not exist: $BACKUP_DIR"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

# Index existing archives in the flat root.
shopt -s nullglob
ARCHIVES=("$BACKUP_DIR"/lifeos-*.sql.gz.enc)
shopt -u nullglob
if [[ ${#ARCHIVES[@]} -eq 0 ]]; then
  log "no archives in $BACKUP_DIR — nothing to do"
  exit 0
fi

# --- 1. Promote each archive into the buckets it represents -----------------
log "promoting ${#ARCHIVES[@]} archive(s) into daily/weekly/monthly tiers…"
for src in "${ARCHIVES[@]}"; do
  fname="$(basename "$src")"
  # Extract YYYYMMDD from the filename: lifeos-YYYYMMDDTHHMMSSZ.sql.gz.enc
  if [[ ! "$fname" =~ ^lifeos-([0-9]{8})T[0-9]{6}Z\.sql\.gz\.enc$ ]]; then
    log "  skip (bad filename): $fname"
    continue
  fi
  ymd="${BASH_REMATCH[1]}"
  yyyy="${ymd:0:4}"; mm="${ymd:4:2}"; dd="${ymd:6:2}"
  iso_week="$(date -u -d "${yyyy}-${mm}-${dd}" +%G-W%V)"
  ym="${yyyy}-${mm}"

  # Daily — every archive promoted as itself.
  if [[ ! -e "$DAILY_DIR/$fname" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then log "  [dry] daily ← $fname"
    else ln -f "$src" "$DAILY_DIR/$fname" 2>/dev/null || cp -al "$src" "$DAILY_DIR/$fname"; fi
  fi
  # Weekly — only the OLDEST archive of each ISO week wins (first one becomes the
  # week's canonical snapshot; subsequent archives in the same week are skipped).
  if ! find "$WEEKLY_DIR" -maxdepth 1 -name "lifeos-*.sql.gz.enc" -print 2>/dev/null \
        | xargs -I{} basename {} 2>/dev/null \
        | grep -q "^lifeos-${iso_week//-W/}"; then
    : # placeholder — guard below uses date-based matching
  fi
  weekly_marker="$WEEKLY_DIR/.${iso_week}"
  if [[ ! -f "$weekly_marker" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then log "  [dry] weekly ($iso_week) ← $fname"
    else
      ln -f "$src" "$WEEKLY_DIR/$fname" 2>/dev/null || cp -al "$src" "$WEEKLY_DIR/$fname"
      : > "$weekly_marker"
    fi
  fi
  # Monthly — same idea, keyed by YYYY-MM.
  monthly_marker="$MONTHLY_DIR/.${ym}"
  if [[ ! -f "$monthly_marker" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then log "  [dry] monthly ($ym) ← $fname"
    else
      ln -f "$src" "$MONTHLY_DIR/$fname" 2>/dev/null || cp -al "$src" "$MONTHLY_DIR/$fname"
      : > "$monthly_marker"
    fi
  fi
done

# --- 2. Prune each bucket independently --------------------------------------
prune_bucket() {
  local dir="$1" keep="$2" label="$3"
  shopt -s nullglob
  local files=("$dir"/lifeos-*.sql.gz.enc)
  shopt -u nullglob
  if [[ ${#files[@]} -le $keep ]]; then
    log "$label: ${#files[@]} archive(s); under cap of $keep — nothing to prune"
    return 0
  fi
  # Sort by filename (timestamp is the prefix → lexical sort = chronological)
  IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort))
  unset IFS
  local cull_count=$(( ${#sorted[@]} - keep ))
  log "$label: pruning $cull_count oldest archive(s) (keep newest $keep)"
  for ((i=0; i<cull_count; i++)); do
    local victim="${sorted[$i]}"
    if [[ "$DRY_RUN" == "true" ]]; then log "  [dry] rm $(basename "$victim")"
    else rm -f "$victim"; fi
  done
}

prune_bucket "$DAILY_DIR" "$DAILY_KEEP" "daily"
prune_bucket "$WEEKLY_DIR" "$WEEKLY_KEEP" "weekly"
prune_bucket "$MONTHLY_DIR" "$MONTHLY_KEEP" "monthly"

# --- 3. Prune the flat root --------------------------------------------------
# Anything in $BACKUP_DIR/lifeos-* older than DAILY_KEEP days is no longer
# referenced from the buckets either (the markers above ensure each bucket
# has its representative). Safe to delete.
if [[ "$DRY_RUN" == "true" ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -name 'lifeos-*.sql.gz.enc' \
    -mtime "+$DAILY_KEEP" -printf '  [dry] rm %f\n' 2>/dev/null || true
else
  find "$BACKUP_DIR" -maxdepth 1 -name 'lifeos-*.sql.gz.enc' \
    -mtime "+$DAILY_KEEP" -delete 2>/dev/null || true
fi

log "done. tiers under $BACKUP_DIR — daily=$DAILY_KEEP weekly=$WEEKLY_KEEP monthly=$MONTHLY_KEEP"
