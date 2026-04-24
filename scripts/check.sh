#!/usr/bin/env bash
# Run lint + typecheck + tests across all workspaces.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> typecheck"
npm run typecheck

echo "==> lint (best-effort)"
npm run lint || echo "(lint reported issues — fix when convenient)"

echo "==> test"
npm test
