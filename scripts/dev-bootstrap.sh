#!/usr/bin/env bash
# One-shot dev environment bootstrap for huy-server (or any fresh checkout).
# Idempotent — safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▸ checking node version"
node --version

echo "▸ copying .env.example files (only if missing)"
for f in .env apps/api/.env apps/mobile/.env; do
  example="${f}.example"
  # apps/mobile/.env.example exists; root .env.example exists; apps/api/.env.example exists
  if [ -f "$example" ] && [ ! -f "$f" ]; then
    cp "$example" "$f"
    echo "  created $f from $example"
  fi
done

echo "▸ installing workspace deps"
npm install

echo "▸ starting Postgres + Redis"
docker compose up -d postgres redis

echo "▸ waiting for Postgres to accept connections"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-lifeos}" >/dev/null 2>&1; then
    echo "  Postgres ready"
    break
  fi
  sleep 1
done

echo "▸ generating Prisma client + applying dev migrations"
npm run db:migrate:dev --workspace @lifeos/api -- --name init || true

echo
echo "✓ bootstrap done. Next:"
echo "    npm run dev          # API + mobile in parallel"
echo "    npm run dev:api      # only API"
echo "    npm run dev:mobile   # only Expo"
