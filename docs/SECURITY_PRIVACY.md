# LifeOS AI — Security & Privacy

This is the document the team comes back to before *anything* sensitive ships.
If a change conflicts with this, the change waits.

## Threat model (MVP scope)

We protect against:
- A stolen mobile device — the OpenAI key must not be recoverable.
- A leaked database backup — the OpenAI key, passwords, and refresh tokens
  must not be useful.
- A compromised log shipper — logs must not contain key material or secrets.
- A curious operator — production env files are the only place keys live.

We do **not** yet protect against:
- A compromised API host (post-exploitation). MVP runs on a single trusted
  box; defence-in-depth is phase 2.
- Side-channel attacks on the OpenAI provider itself.
- Government-level adversaries.

## Secrets at rest

| Secret | Where | How |
|---|---|---|
| User password | Postgres `User.passwordHash` | bcrypt cost 12 |
| Refresh token | Postgres `Session.refreshTokenHash` | sha256 hash, rotated each use |
| OpenAI API key | Postgres `AiCredential.{encryptedApiKey, iv, authTag}` | AES-256-GCM, 12-byte IV per row, 16-byte auth tag |
| `ENCRYPTION_KEY` | API env var only | 32-byte hex, rotated only via re-encryption migration |
| `JWT_*_SECRET` | API env var only | 48-byte random base64 |

Plaintext OpenAI keys may exist only:
1. In transit, inside the TLS-terminated request body.
2. In a single function scope on the API while a model call is in flight.

They must never appear in:
- Application logs (`Logger.log`, `console.log`).
- Postgres logs (use parameterised queries — Prisma does this by default).
- Crash reports / stack traces.
- Audit tables.
- Backup tables.

## Secrets in transit

- TLS only. Dev box uses Cloudflare Tunnel; production will too. Plain-HTTP
  in dev is acceptable on localhost only.
- HSTS: 1 year, includeSubDomains, preload (set at the tunnel layer).
- No mixed-content. Mobile config rejects `http://` API base URLs in
  production builds.

## Authentication

- JWT access token: 15 minutes, signed with `JWT_ACCESS_SECRET`.
- JWT refresh token: 30 days, signed with `JWT_REFRESH_SECRET`, **and** stored
  hashed in `Session.refreshTokenHash`. The plaintext refresh leaves the server
  exactly twice: at issue and at rotation.
- Refresh rotation: every successful refresh revokes the previous session row
  and creates a new one. A replayed refresh token returns 401 + `token_revoked`
  and revokes *all* sessions for that user (assumed theft).
- Bcrypt cost 12 for passwords (~250 ms on dev box; tune for production CPU).

## Authorisation

- Single-user data. Every authenticated query is scoped by `userId = req.user.id`
  at the service layer. There is no admin role in MVP.
- `JwtAuthGuard` is the default guard at module level; `@Public()` decorator
  opts a route out (for `/health`, `/auth/register`, `/auth/login`,
  `/auth/refresh`).

## Input validation

- Every `@Body()` is parsed with a Zod schema from `@lifeos/shared`. No
  controller manipulates raw JSON.
- Path/query params are coerced and validated via `class-validator` DTOs.
- File uploads are not in MVP. When added, allow-list MIME types + size cap.

## Logging & redaction

- Production logger: pino, JSON, level `info`.
- Redact paths: `password`, `passwordHash`, `apiKey`, `encryptedApiKey`,
  `refreshToken`, `refreshTokenHash`, `Authorization` header.
- Email: hashed (sha256, first 8 hex chars) before logging.
- A pre-commit hook fails on any added line matching `sk-[a-zA-Z0-9]{20,}`.

## Privacy

- The user owns their data. `DELETE /users/me` (round 4) cascades through
  every feature table. No tombstones in MVP.
- We do **not** train on user data. The OpenAI request uses the user's own
  key — usage and policy follow OpenAI's terms for that account.
- We do **not** ship third-party telemetry (Sentry, Mixpanel, Firebase) in
  the MVP build. Errors are surfaced through the API's own logger.
- Local mobile cache: stored in `expo-secure-store` (key material) and
  AsyncStorage (non-sensitive cache). Wipe on logout.

## Incident response (MVP-light)

- If `ENCRYPTION_KEY` is suspected leaked: rotate via a one-shot script that
  decrypts every `AiCredential` with the old key and re-encrypts with the
  new one in a single transaction. Old key is then deleted.
- If a user reports a stolen device: `POST /auth/sessions/revoke-all`
  (round 1) invalidates every refresh token and forces re-login.
- If a service worker / queue starts logging plaintext: kill the deploy,
  rotate `ENCRYPTION_KEY`, force-revoke all refresh tokens, prompt every user
  to re-enter their OpenAI key on next launch.

## Open questions / parked

- Should we require 2FA for accounts with stored API keys? Tracked for
  phase 2 — out of MVP because it delays first-use too long.
- Backup strategy beyond a daily `pg_dump`? Phase 2.
- Audit log of who changed AiCredential when? Phase 2.
