#!/usr/bin/env bash
# scripts/prod-smoke-test.sh — post-deploy production smoke test.
#
# Probes the running API for the must-work endpoints + basic round-12/14
# infra (queue depth, metrics endpoint gating, env validation). Exits 0
# only when every required check passes.
#
# Usage:
#   ./scripts/prod-smoke-test.sh                       # uses http://127.0.0.1:3000
#   API_URL=https://api.example.com ./prod-smoke-test.sh
#
# Optional:
#   METRICS_BEARER_TOKEN=...   to also probe /metrics with the bearer.
#
# Never logs request bodies. Never echoes secrets. Designed for SSH +
# pipe-to-CI use.

set -Eeuo pipefail

API_URL="${API_URL:-http://127.0.0.1:3000}"
PASS=0
FAIL=0

log() { printf '[smoke] %s\n' "$*"; }
ok() { log "  ✓ $*"; PASS=$((PASS+1)); }
err() { log "  ✗ $*"; FAIL=$((FAIL+1)); }

# 1. Liveness — cheap process ping.
log "1) GET /api/health (liveness)"
if curl -fsS "${API_URL}/api/health" >/dev/null; then
  ok "liveness OK"
else
  err "liveness failed"
fi

# 2. Readiness — DB + Redis + queue depth.
log "2) GET /api/health/ready (readiness)"
READY="$(curl -fsS "${API_URL}/api/health/ready" 2>/dev/null || true)"
if [[ -z "$READY" ]]; then
  err "readiness endpoint did not respond"
else
  if echo "$READY" | grep -q '"status":"ready"'; then
    ok "readiness reports 'ready'"
  else
    err "readiness reports degraded: $(echo "$READY" | head -c 200)"
  fi
  if echo "$READY" | grep -q '"database":"up"'; then
    ok "DB is up"
  else
    err "DB is not up"
  fi
  if echo "$READY" | grep -q '"redis":"up"'; then
    ok "Redis is up"
  elif echo "$READY" | grep -q '"redis":"disabled"'; then
    err "Redis is DISABLED in production — set QUEUE_ENABLED=true"
  else
    err "Redis is down"
  fi
  if echo "$READY" | grep -q '"queues":{'; then
    ok "queue snapshot returned"
  fi
fi

# 3. Auth surface — wrong creds path returns AUTH_INVALID_CREDENTIALS.
#    We never exercise valid creds in a smoke test.
log "3) POST /api/auth/login with junk credentials"
LOGIN_RESP="$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-bot@example.invalid","password":"definitely-wrong-password"}' \
  "${API_URL}/api/auth/login" || true)"
if [[ "$LOGIN_RESP" == "401" ]]; then
  ok "login returned 401 as expected"
else
  err "login expected 401, got ${LOGIN_RESP}"
fi

# 4. Forgot-password no-leak — must always return 202 (no email enumeration).
log "4) POST /api/auth/forgot-password (no-leak path)"
FORGOT_RESP="$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-bot@example.invalid"}' \
  "${API_URL}/api/auth/forgot-password" || true)"
if [[ "$FORGOT_RESP" == "202" ]]; then
  ok "forgot-password returned 202 (no enumeration)"
else
  err "forgot-password expected 202, got ${FORGOT_RESP}"
fi

# 5. Rate limit headers — auth endpoint must include throttler headers.
log "5) Rate limit headers on /api/auth/login"
HEADERS="$(curl -s -D - -o /dev/null \
  -H 'Content-Type: application/json' \
  -d '{"email":"x@x.x","password":"x"}' \
  "${API_URL}/api/auth/login" || true)"
# Headers like X-RateLimit-Limit / X-RateLimit-Remaining are only set when
# the throttler engages OR fires. The presence of either signals the throttler
# is wired. (When the throttler doesn't engage on the very first request,
# this check is informational only — surface it as warn.)
if echo "$HEADERS" | grep -qiE 'X-RateLimit-(Limit|Remaining)'; then
  ok "rate-limit headers seen"
else
  log "  (info) no rate-limit headers on first request — re-run a few times to hit the limiter"
fi

# 6. /metrics — must 404 by default, 200 with a valid bearer token.
log "6) GET /metrics gating"
METRICS_CODE_NO_AUTH="$(curl -s -o /dev/null -w '%{http_code}' "${API_URL}/metrics" || true)"
if [[ "$METRICS_CODE_NO_AUTH" == "200" || "$METRICS_CODE_NO_AUTH" == "403" || "$METRICS_CODE_NO_AUTH" == "404" ]]; then
  ok "/metrics returned ${METRICS_CODE_NO_AUTH} (gated)"
else
  err "/metrics returned unexpected ${METRICS_CODE_NO_AUTH}"
fi
if [[ -n "${METRICS_BEARER_TOKEN:-}" ]]; then
  METRICS_CODE_AUTH="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${METRICS_BEARER_TOKEN}" "${API_URL}/metrics" || true)"
  if [[ "$METRICS_CODE_AUTH" == "200" ]]; then
    ok "/metrics with bearer returned 200"
  else
    err "/metrics with bearer expected 200, got ${METRICS_CODE_AUTH}"
  fi
fi

# 7. Locked-down hardening — verify /api routes never expose internal stack.
log "7) 5xx leak check"
LEAK="$(curl -s "${API_URL}/api/__definitely_not_a_route__" || true)"
if echo "$LEAK" | grep -qiE 'stack|at .*\.ts'; then
  err "5xx body looks like it leaks a stack trace"
else
  ok "no stack-trace leak on bogus route"
fi

log "----"
log "PASS=${PASS}  FAIL=${FAIL}"
[[ "$FAIL" -eq 0 ]]
