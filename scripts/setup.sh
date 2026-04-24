#!/usr/bin/env bash
# One-shot dev setup: env files, install, db, migrate, seed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cp_if_missing() {
  local src="$1" dst="$2"
  if [[ ! -f "$dst" ]]; then
    cp "$src" "$dst"
    echo "  + created $dst"
  else
    echo "  · $dst already exists, leaving untouched"
  fi
}

echo "[1/4] Copying .env.example files..."
cp_if_missing .env.example .env
cp_if_missing apps/api/.env.example apps/api/.env
cp_if_missing apps/mobile/.env.example apps/mobile/.env
cp_if_missing docker/.env.example docker/.env

echo "[2/4] Installing dependencies..."
npm install

echo "[3/4] Starting Postgres..."
docker compose -f docker/docker-compose.yml up -d

echo "[4/4] Generating Prisma client + running migrations..."
npm run --workspace @planner/api db:generate
npm run --workspace @planner/api db:migrate -- --name init

echo
echo "Done. Next:"
echo "  npm run dev:api      # in one terminal"
echo "  npm run dev:mobile   # in another"
