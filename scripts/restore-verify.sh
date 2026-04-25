#!/usr/bin/env bash
# scripts/restore-verify.sh — canonical sanity checks after a restore drill.
#
# Runs read-only queries against the target DATABASE_URL and asserts:
#   1. every required table exists (catches a partial restore early)
#   2. row counts on the canonical tables are non-zero (or are zero with
#      explicit --allow-empty)
#   3. the most recent write on each canonical table is no older than
#      MAX_AGE_HOURS (defaults 26h, accounting for nightly-dump cadence)
#
# Designed to run against a SCRATCH DB after `restore-db-encrypted.sh`.
# Refuses to run if DATABASE_URL contains the substring `prod` unless
# --allow-prod-readonly is passed (the queries are read-only, but you
# probably don't want to lock-step a verify against your live primary).
#
# Usage:
#   DATABASE_URL=postgres://postgres:scratch@localhost:5499/scratch \
#     ./scripts/restore-verify.sh
#
# Optional env:
#   MAX_AGE_HOURS=72   # bump when restoring an old archive
#   --allow-empty      # treat empty tables as PASS (useful for fresh installs)
#   --allow-prod-readonly  # bypass the "prod" guard

set -Eeuo pipefail

ALLOW_EMPTY="false"
ALLOW_PROD_RO="false"
for arg in "$@"; do
  [[ "$arg" == "--allow-empty" ]] && ALLOW_EMPTY="true"
  [[ "$arg" == "--allow-prod-readonly" ]] && ALLOW_PROD_RO="true"
done

MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

log() { printf '[verify] %s\n' "$*"; }
ok() { log "  ✓ $*"; PASS=$((PASS+1)); }
err() { log "  ✗ $*"; FAIL=$((FAIL+1)); }

[[ -n "${DATABASE_URL:-}" ]] || { log "ERROR: DATABASE_URL required"; exit 2; }
command -v psql >/dev/null || { log "ERROR: psql not in PATH"; exit 2; }

if [[ "$DATABASE_URL" == *prod* && "$ALLOW_PROD_RO" != "true" ]]; then
  log "ERROR: DATABASE_URL looks like production. Pass --allow-prod-readonly to override."
  exit 2
fi

PASS=0
FAIL=0

# Helper that runs a single SQL statement and prints just the value.
psqlx() { psql -X -A -t -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -c "$1"; }

# 1. Required tables.
REQUIRED_TABLES=(
  users wallets incomes expenses budgets debts saving_goals
  tasks habits habit_logs schedule_items daily_schedules
  ai_recommendations ai_messages
  notification_logs finance_audit_logs security_audit_logs
)
log "1) verifying required tables exist"
for t in "${REQUIRED_TABLES[@]}"; do
  exists="$(psqlx "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}');" | tr -d '[:space:]')"
  if [[ "$exists" == "t" ]]; then
    ok "table ${t}"
  else
    err "table ${t} MISSING"
  fi
done

# 2. Row counts on canonical tables (the round-16 acceptance set).
CANONICAL=(users wallets expenses daily_schedules ai_recommendations)
log "2) row counts on canonical tables"
for t in "${CANONICAL[@]}"; do
  n="$(psqlx "SELECT COUNT(*) FROM ${t};" | tr -d '[:space:]')"
  if [[ -z "$n" || ! "$n" =~ ^[0-9]+$ ]]; then
    err "${t}: count query failed"
    continue
  fi
  if [[ "$n" -eq 0 && "$ALLOW_EMPTY" != "true" ]]; then
    err "${t}: 0 rows (pass --allow-empty for fresh install)"
  else
    ok "${t}: ${n} row(s)"
  fi
done

# 3. Freshness checks. Skip when --allow-empty (a fresh DB has no createdAt).
if [[ "$ALLOW_EMPTY" != "true" ]]; then
  log "3) freshness — newest row no older than ${MAX_AGE_HOURS}h"
  freshness_check() {
    local table="$1" col="$2"
    local age
    age="$(psqlx "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(\"${col}\"))) / 3600.0 FROM ${table};" \
      | tr -d '[:space:]')"
    if [[ -z "$age" || "$age" == "" ]]; then
      err "${table}.${col}: no rows"
      return
    fi
    # bash can't do float compare; use awk.
    if awk -v a="$age" -v m="$MAX_AGE_HOURS" 'BEGIN{exit !(a <= m)}'; then
      ok "${table}.${col} latest = $(printf '%.1f' "$age")h ago"
    else
      err "${table}.${col} latest = $(printf '%.1f' "$age")h ago (> ${MAX_AGE_HOURS}h)"
    fi
  }
  freshness_check users        createdAt
  freshness_check expenses     createdAt
  freshness_check ai_recommendations createdAt
  freshness_check finance_audit_logs createdAt
fi

log "----"
log "PASS=${PASS}  FAIL=${FAIL}"
[[ "$FAIL" -eq 0 ]]
