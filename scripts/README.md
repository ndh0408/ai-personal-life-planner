# scripts/

Helper scripts. Most day-to-day commands are exposed via `npm run …` at the repo root —
see the root `package.json`. The wrappers here exist for one-shot flows.

| Script | Purpose |
| --- | --- |
| `setup.sh` / `setup.ps1` | First-time setup: copy env files, `npm install`, start Postgres, run migrations. |
| `check.sh` | Convenience: typecheck → lint → test across all workspaces. |

Make `.sh` files executable on Unix: `chmod +x scripts/*.sh`.
