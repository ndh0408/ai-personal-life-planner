# LifeOS AI — Auth Flow

Authentication for the mobile client. Stateless access tokens for fast
request-time checks; rotating refresh tokens for long-lived sessions; every
sensitive action is server-side.

> Endpoint shapes live in [API_CONTRACT.md](./API_CONTRACT.md).
> Wire envelope and error-code mechanics live in [API_FOUNDATION.md](./API_FOUNDATION.md).
> Threat model + crypto choices live in [SECURITY_PRIVACY.md](./SECURITY_PRIVACY.md).

---

## Tokens at a glance

| Token | TTL | Where it lives | Purpose |
|---|---|---|---|
| Access JWT | 15 min (`JWT_ACCESS_TTL`) | Mobile memory + secure store. Sent as `Authorization: Bearer …`. | Authorize each API call. Stateless — no DB read on the hot path. |
| Refresh JWT | 30 days (`JWT_REFRESH_TTL`) | Mobile secure store only. Sent in the body of `/auth/refresh` and `/auth/logout`. | Mint a new pair when the access token expires. |

The refresh JWT is also stored **hashed** server-side (`RefreshToken.tokenHash`).
The plaintext refresh leaves the server exactly twice: at issue, and at the
moment of rotation.

JWT claims:

```ts
// access  — secret: JWT_ACCESS_SECRET
{ sub: userId, email, type: 'access', iat, exp }

// refresh — secret: JWT_REFRESH_SECRET, NEVER signed with the access secret
{ sub: userId, jti: refreshTokenRowId, type: 'refresh', iat, exp }
```

The `jti` doubles as the `RefreshToken.id` so verification needs at most one
indexed lookup.

---

## The five endpoints

```
POST /api/auth/register      → AuthResponse  (201)
POST /api/auth/login         → AuthResponse  (200)
POST /api/auth/refresh       → { tokens }    (200)
POST /api/auth/logout        → 204           (auth required)
GET  /api/me                 → UserPublic    (auth required)
```

`AuthResponse`:
```ts
{
  user:   { id, email, displayName, emailVerifiedAt, status, createdAt },
  tokens: { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }
}
```

`passwordHash` is **never** in any response.

---

## Detailed flows

### Register

```
mobile                          api                        postgres
  │ POST /auth/register          │                            │
  │  { email, password, name? }  │                            │
  │ ────────────────────────────▶│                            │
  │                              │  bcrypt.hash(password,12)  │
  │                              │  user.create()             │
  │                              │ ──────────────────────────▶│
  │                              │  + UserProfile             │
  │                              │  + PrivacySetting          │
  │                              │  + NotificationSetting     │
  │                              │  (one transaction)         │
  │                              │  issue tokens, store hash  │
  │                              │ ──────────────────────────▶│
  │  201 + AuthResponse          │                            │
  │ ◀────────────────────────────│                            │
```

- **Conflict:** if email is taken, returns 409 with `errorCode: EMAIL_TAKEN`.
  No timing leak: bcrypt isn't called on conflict because the `User.create`
  fails on the unique constraint.

### Login

- Always runs `bcrypt.compare` even when the user doesn't exist? **No** — we
  return early with `INVALID_CREDENTIALS` to avoid wasted CPU. The error
  message is identical for both "no such user" and "wrong password" so the
  client can't probe email existence by reading the message. Timing leak
  exists but is small (~0 ms for "no user" vs ~250 ms for "wrong pw"); closing
  this gap is parked until phase 2 because it costs latency on every login.

- Disabled accounts return 403 `ACCOUNT_DISABLED`.

### Refresh + rotation

```
mobile                          api                        postgres
  │ POST /auth/refresh           │                            │
  │  { refreshToken }            │                            │
  │ ────────────────────────────▶│                            │
  │                              │ jwt.verify(refresh)        │
  │                              │ findFirst({                │
  │                              │   id:      payload.jti,    │
  │                              │   userId:  payload.sub,    │
  │                              │   tokenHash: sha256(rt) }) │
  │                              │ ──────────────────────────▶│
  │                              │  ┌───────────────┐         │
  │                              │  │ found + alive │         │
  │                              │  └───────────────┘         │
  │                              │  txn:                      │
  │                              │   row.revokedAt = now      │
  │                              │   create new row + tokens  │
  │                              │ ──────────────────────────▶│
  │  200 + { tokens }            │                            │
  │ ◀────────────────────────────│                            │
```

**Theft detection.** If verification finds a refresh that is either:

- not in the table (forged or matches a row hash that isn't this token), OR
- already revoked (replay)

then **every** active session for that user is revoked. The legitimate user
will be forced to log in again from every device — a user-visible event but
the right move under suspicion of compromise. Triggered errorCodes:
`INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REVOKED`.

Expired refresh just returns `REFRESH_TOKEN_EXPIRED` with no sweep.

### Logout

- `POST /auth/logout` requires the access token. Body: `{ refreshToken? }`.
- If the body includes the current refresh, only that session is revoked.
- If the body is empty, **all** of the user's sessions are revoked
  (multi-device sign-out).

### `GET /api/me`

- The `JwtAuthGuard` (global, with `@Public` opt-out) verifies the access
  token and attaches `req.user = { id, email }`.
- The handler reads the row by id and returns `UserPublic`.

---

## Error catalog (auth)

| HTTP | `errorCode` | When |
|---|---|---|
| 400 | `validation_failed` | Body fails Zod schema (e.g. password < 8) |
| 401 | `INVALID_CREDENTIALS` | Email + password mismatch (or no such user) |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh JWT signature/format invalid |
| 401 | `REFRESH_TOKEN_REVOKED` | Refresh row was revoked (rotated, logged out, theft sweep) |
| 401 | `REFRESH_TOKEN_EXPIRED` | Refresh row is past `expiresAt` |
| 401 | `missing_token` | No `Authorization: Bearer …` on a protected route |
| 401 | `invalid_token` | Access JWT bad signature / expired |
| 401 | `UNAUTHENTICATED` | `/me` couldn't find the row (account deleted between issue and use) |
| 403 | `ACCOUNT_DISABLED` | `User.status = DISABLED` |
| 409 | `EMAIL_TAKEN` | Register hit the unique email constraint |
| 429 | `RATE_LIMITED` | Per-IP throttle hit (10/min on register/login, 30/min on refresh) |

Mobile clients **switch on `errorCode`**, not on `message`. Messages are i18n
strings safe to render verbatim, but they may be reworded over time.

---

## Rate limits (round 1)

| Route | Limit |
|---|---|
| `POST /auth/register` | 10 / minute / IP |
| `POST /auth/login`    | 10 / minute / IP |
| `POST /auth/refresh`  | 30 / minute / IP |
| Everything else       | global default (100 / minute, see env `THROTTLE_*`) |

---

## Mobile client checklist

- Store access in memory + secure store; refresh in **secure store only**.
- On 401: try refresh **once** sequentially, replay the original request, then
  give up and route to login.
- On `REFRESH_TOKEN_REVOKED` / `REFRESH_TOKEN_EXPIRED`: clear all stored
  tokens and route to login. Do **not** silently swallow — show a toast
  ("Phiên hết hạn, đăng nhập lại").
- On `EMAIL_TAKEN`: highlight the email field, suggest "Bạn đã có tài khoản? Đăng nhập".
- Never log access or refresh tokens. They are bearer secrets.

---

## What's not done (parked)

- 2FA / device approval — phase 2.
- "Logout from all other devices" UI affordance (the API supports it via
  empty `refreshToken` in `/logout`, but no screen yet).
- Password reset email — needs a mailer; phase 2.
- Email verification flow — accounts ship with `emailVerifiedAt = null`;
  the field exists, the flow doesn't.
- Constant-time login for non-existent users — see "Login" note above.
