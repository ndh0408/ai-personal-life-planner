#!/usr/bin/env bash
# Quick guardrail: warn if any .env files appear staged for commit.
set -euo pipefail

if git diff --cached --name-only | grep -E '(^|/)\.env$' >/dev/null; then
  echo "✗ refusing to commit a .env file (only .env.example may be tracked)"
  exit 1
fi
echo "✓ no .env files staged"
