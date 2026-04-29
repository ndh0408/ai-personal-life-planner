# Secrets management

The API depends on three families of secrets:

1. **JWT** signing keys (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
2. **At-rest encryption** for per-user OpenAI keys
   (`USER_AI_KEY_ENCRYPTION_KEY`).
3. **Database / cache** credentials (`POSTGRES_PASSWORD`, etc).

This doc lays out how they're stored, rotated, and audited across the
environments LifeOS AI runs in.

## Generation

| Secret | Command | Format |
|---|---|---|
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` | base64, ≥ 32 chars |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` | base64, ≥ 32 chars |
| `USER_AI_KEY_ENCRYPTION_KEY` | `openssl rand -hex 32` | exactly 64 hex chars |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` | any printable |

The env validator (`apps/api/src/config/env.schema.ts`) rejects values
that don't meet the format requirements at boot — there's no "almost
configured" state.

## Storage

### Local development

`apps/api/.env` (gitignored). Values are derived from
`apps/api/.env.example`. Devs each maintain their own; the dev DB is
disposable so password rotation costs nothing.

### Production (today — Cloudflare Tunnel + docker compose)

`/etc/lifeos/api.env` on `huy-server`, mode `0600`, owned by the
`lifeos` system user. The compose file (`compose.prod.yaml`) reads it
via `env_file:` once we wire that in (currently inline `environment:`,
to be migrated in round 29).

### Production (next — Docker secrets / external KMS)

Migration target: `secrets:` blocks in `compose.prod.yaml` with values
mounted to `/run/secrets/<name>` so the secret never appears in
`docker inspect`. Example:

```yaml
secrets:
  jwt_access_secret:
    file: /etc/lifeos/secrets/jwt_access_secret
  user_ai_key_encryption_key:
    file: /etc/lifeos/secrets/user_ai_key_encryption_key

services:
  api:
    secrets:
      - jwt_access_secret
      - user_ai_key_encryption_key
    environment:
      JWT_ACCESS_SECRET_FILE: /run/secrets/jwt_access_secret
      USER_AI_KEY_ENCRYPTION_KEY_FILE: /run/secrets/user_ai_key_encryption_key
```

The `validateEnv` schema would gain a small loader that reads `*_FILE`
references when present, falling back to the inline value otherwise.

## Rotation

| Secret | Cadence | Procedure |
|---|---|---|
| `JWT_ACCESS_SECRET` | Yearly, or after any leak | Rotate → all access tokens invalidate within 15 min (their TTL). Refresh tokens keep working until they're rotated again. |
| `JWT_REFRESH_SECRET` | Yearly, or after any leak | Rotate → every user must re-login. Coordinate with a deploy window. |
| `USER_AI_KEY_ENCRYPTION_KEY` | **Never trivially**. Rotation requires a key-version migration: every encrypted row must be re-encrypted with the new key. Until that ships in round 29, treat this as the most sensitive secret in the system. |
| `POSTGRES_PASSWORD` | Yearly | `ALTER USER lifeos WITH PASSWORD '…';` then redeploy with the new env. |

For the OpenAI keys themselves: those are per-user, encrypted in the
`UserAiKey` table. Users can rotate from the mobile app
(Settings → AI key) — that flow re-encrypts before persisting.

## Auditing

- Server never logs raw secrets — `redact.util.ts` (round 19) strips
  `Authorization`, `*token*`, `*secret*`, `*password*`, `*apiKey*`,
  `encryptedApiKey` from any object before it reaches the logger.
- The exception filter strips query strings off URLs before logging
  (some clients leak `?access_token=`).
- Mobile DevPanel shows `Auth stage`, never the access token itself.
- `EventLog` rows are user-scoped; admin queries against them must run
  through the privacy module's data-export path (round 29+).

## What to do on suspected leak

1. Rotate the affected secret.
2. Force-revoke active sessions:
   ```sql
   UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;
   ```
3. Inspect `EventLog` for unusual capture/undo activity in the last 24 h.
4. If `USER_AI_KEY_ENCRYPTION_KEY` is the leaked secret: every user must
   re-enter their OpenAI key. Coordinate via in-app banner.
