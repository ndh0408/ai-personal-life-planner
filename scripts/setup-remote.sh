#!/usr/bin/env bash
#
# LifeOS AI — remote bootstrap for a Linux dev box.
#
# Assumes: Debian/Ubuntu-like, user has docker group membership, ~180 MB free.
# Idempotent: safe to re-run.
#
# What this does on the target machine:
#   1. Installs nvm + Node 20 LTS (if missing), without sudo.
#   2. Installs Claude Code CLI globally (if missing).
#   3. Ensures the repo is cloned to ~/AppQuanLY (or pulls latest).
#   4. Creates .env files from .env.example and fills strong JWT secrets.
#   5. Starts Postgres via docker compose.
#   6. Installs npm workspaces, generates Prisma client, applies migrations,
#      seeds demo data.
#   7. Runs a smoke test (typecheck + tests) and reports.
#
# Re-run with CLEAN=1 ./scripts/setup-remote.sh to wipe node_modules + DB volume.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/ndh0408/ai-personal-life-planner.git}"
REPO_DIR="${REPO_DIR:-$HOME/AppQuanLY}"
NODE_VERSION="${NODE_VERSION:-20}"
CLAUDE_CODE_PKG="${CLAUDE_CODE_PKG:-@anthropic-ai/claude-code}"

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n'  "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n'  "$*" >&2; exit 1; }

# ---- 1. nvm + node --------------------------------------------------------
if [ -z "${NVM_DIR:-}" ]; then
  export NVM_DIR="$HOME/.nvm"
fi
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  log "Installing nvm to $NVM_DIR"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"

if ! nvm ls "$NODE_VERSION" >/dev/null 2>&1; then
  log "Installing Node $NODE_VERSION"
  nvm install "$NODE_VERSION"
fi
nvm use "$NODE_VERSION" >/dev/null
nvm alias default "$NODE_VERSION" >/dev/null
log "node=$(node -v)  npm=$(npm -v)"

# ---- 2. Claude Code CLI ---------------------------------------------------
if ! command -v claude >/dev/null 2>&1; then
  log "Installing $CLAUDE_CODE_PKG globally"
  npm install -g "$CLAUDE_CODE_PKG"
fi
log "claude=$(claude --version 2>/dev/null || echo '(not reporting version)')"

# ---- 3. Clone / pull repo -------------------------------------------------
if [ ! -d "$REPO_DIR/.git" ]; then
  log "Cloning $REPO_URL → $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
else
  log "Pulling latest in $REPO_DIR"
  git -C "$REPO_DIR" pull --ff-only
fi
cd "$REPO_DIR"

# ---- 4. .env files --------------------------------------------------------
rand_secret() { openssl rand -hex 48; }

ensure_env() {
  local template="$1"
  local target="$2"
  if [ ! -f "$target" ]; then
    cp "$template" "$target"
    log "Created $target from $template"
  fi
}

ensure_env .env.example .env
ensure_env apps/api/.env.example apps/api/.env
ensure_env apps/mobile/.env.example apps/mobile/.env

# Only replace JWT placeholders, never rewrite real secrets.
api_env="apps/api/.env"
if grep -q 'change_me_access_secret' "$api_env"; then
  log "Generating strong JWT_ACCESS_SECRET"
  sed -i "s|change_me_access_secret_at_least_32_chars_long|$(rand_secret)|" "$api_env"
fi
if grep -q 'change_me_refresh_secret' "$api_env"; then
  log "Generating strong JWT_REFRESH_SECRET"
  sed -i "s|change_me_refresh_secret_at_least_32_chars_long|$(rand_secret)|" "$api_env"
fi

# ---- 5. Docker + Postgres -------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  die "docker is installed but unreachable — check that \$USER is in the 'docker' group (or run: sudo usermod -aG docker \$USER && newgrp docker)"
fi
log "Starting Postgres via docker compose"
npm run dev:db >/dev/null

# Wait until Postgres is ready (pg_isready via container).
for i in $(seq 1 30); do
  if docker exec planner-postgres pg_isready -U planner -d planner >/dev/null 2>&1; then
    log "Postgres ready after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    die "Postgres did not become ready within 30s. Check: docker logs planner-postgres"
  fi
done

# ---- 6. Install + migrate + seed ------------------------------------------
if [ "${CLEAN:-0}" = "1" ]; then
  warn "CLEAN=1 — removing node_modules + resetting DB"
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
fi

log "npm install (workspaces)"
npm install

# @planner/shared ships compiled dist/; it's dev-only infrastructure and is
# gitignored, so a fresh checkout must build it before workspaces that depend
# on it can typecheck.
log "build:shared"
npm run --workspace packages/shared build

log "prisma generate"
npx --workspace apps/api prisma generate

log "prisma migrate deploy"
npm run --workspace apps/api db:migrate:deploy

log "db:seed"
npm run db:seed

# ---- 7. Smoke ---------------------------------------------------------------
log "typecheck"
npm run typecheck
log "tests (API)"
npm test --workspace apps/api

cat <<'SUMMARY'

==============================================================================
 LifeOS AI — remote bootstrap complete.
==============================================================================

Repo:    ~/AppQuanLY
Login:   demo@planner.local / demo1234

Next:
  cd ~/AppQuanLY
  npm run dev:api            # backend on :3000
  # In another shell:
  claude                      # resume in this project

Tips:
  CLEAN=1 ./scripts/setup-remote.sh   # rebuild from scratch
  npm run db:studio                    # open Prisma Studio (needs tunnel)
  docker logs planner-postgres         # Postgres logs
SUMMARY
