#!/usr/bin/env bash
# Production deploy for the LifeOS API (round 28).
#
# Run on the prod host. Pulls the current branch, builds the api image,
# applies any new Prisma migrations, then restarts the api service while
# leaving postgres + redis untouched (they hold persistent state).
#
# Usage:
#   bash scripts/deploy-prod.sh
#   bash scripts/deploy-prod.sh --no-migrate    # skip migrate deploy
#
# Requires:
#   - /etc/lifeos/api.env exists and is mode 0600
#   - docker + docker compose v2 installed
#   - You ran the round-28 secret rotation if any of the JWT/encryption
#     keys are still placeholders (`scripts/check-env.sh` will fail loudly)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f /etc/lifeos/api.env ]]; then
  echo "Missing /etc/lifeos/api.env. Copy from .env.example and fill secrets." >&2
  exit 1
fi

MIGRATE=1
for arg in "$@"; do
  case "$arg" in
    --no-migrate) MIGRATE=0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

echo "==> Pulling latest master"
git pull --ff-only origin master

echo "==> Building api image"
docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
  build api

if [[ "$MIGRATE" == "1" ]]; then
  echo "==> Running prisma migrate deploy in a one-off container"
  # Run against the live DB without touching the running api container so
  # an aborted migration doesn't take user traffic down.
  docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
    run --rm --no-deps api npx prisma migrate deploy
fi

echo "==> Restarting api"
docker compose -f compose.yaml -f compose.prod.yaml --env-file /etc/lifeos/api.env \
  up -d --no-deps api

echo "==> Waiting for /health/ready"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/health/ready >/dev/null 2>&1; then
    echo "✓ API ready"
    exit 0
  fi
  sleep 2
done

echo "✗ API did not become ready within 60 s. Check logs:" >&2
echo "  docker compose -f compose.yaml -f compose.prod.yaml logs api" >&2
exit 1
