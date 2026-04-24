# Auth flow — LifeOS AI

JWT access + refresh tokens, with refresh tokens stored as SHA-256 hashes in the database so a DB leak never reveals a reusable token.

## Token lifetimes

| Token | TTL (default) | Where it lives on the client | Rotated? |
| --- | --- | --- | --- |
| Access | `15m` (`JWT_ACCESS_EXPIRES_IN`) | Memory + AsyncStorage (mobile) | No — short-lived |
| Refresh | `30d` (`JWT_REFRESH_EXPIRES_IN`) | SecureStore (mobile) | **Yes — on every `/auth/refresh`** |

Values are overridable per environment; never log tokens regardless of level.

## Endpoints

| Endpoint | Rate limit (per IP / min) | Auth required |
| --- | --- | --- |
| `POST /api/auth/register` | 5 | No |
| `POST /api/auth/login` | 10 | No |
| `POST /api/auth/refresh` | 30 | No (carries refresh in body) |
| `POST /api/auth/logout` | 10 (controller default) | Yes (Bearer) |
| `GET /api/me` | global (120/min) | Yes |

Rate-limit values are enforced by `@nestjs/throttler`; override globally via `THROTTLE_TTL` / `THROTTLE_LIMIT`, and per-endpoint via the `@Throttle()` decorator in `auth.controller.ts`.

## Flows

### Register

```
Client                                        API
  |  POST /api/auth/register                     |
  |  { email, password, name?, timezone? }       |
  |--------------------------------------------->|
  |                                              |  1. Zod validation
  |                                              |  2. Check email uniqueness → 409 AUTH_EMAIL_TAKEN
  |                                              |  3. bcrypt hash password (cost 10)
  |                                              |  4. Create user + empty UserProfile + default NotificationSetting
  |                                              |  5. Sign access+refresh JWTs
  |                                              |  6. Store sha256(refreshToken) in refresh_tokens
  |  200 OK                                      |
  |  { accessToken, refreshToken, expiresIn }    |
  |<---------------------------------------------|
```

### Login

```
Client                                        API
  |  POST /api/auth/login                        |
  |  { email, password }                         |
  |--------------------------------------------->|
  |                                              |  1. Zod validation
  |                                              |  2. Find user → 401 AUTH_INVALID_CREDENTIALS if missing
  |                                              |  3. Reject if status=DISABLED → 401 AUTH_ACCOUNT_DISABLED
  |                                              |  4. bcrypt.compare → 401 AUTH_INVALID_CREDENTIALS if wrong
  |                                              |  5. Sign + persist as in register
  |  200 OK                                      |
  |  { accessToken, refreshToken, expiresIn }    |
  |<---------------------------------------------|
```

### Refresh (rotation)

```
Client                                        API
  |  POST /api/auth/refresh                      |
  |  { refreshToken }                            |
  |--------------------------------------------->|
  |                                              |  1. sha256(refreshToken) lookup
  |                                              |  2. Reject if revoked / expired → 401 AUTH_INVALID_REFRESH_TOKEN
  |                                              |  3. Mark old record revokedAt=now()
  |                                              |  4. Issue new access + new refresh (stored hashed)
  |  200 OK                                      |
  |  { accessToken, refreshToken, expiresIn }    |
  |<---------------------------------------------|
```

Rotation means a stolen refresh token becomes useless as soon as the legitimate client uses its own refresh.

### Logout

```
Client                                        API
  |  POST /api/auth/logout   (Bearer)            |
  |--------------------------------------------->|
  |                                              |  1. JWT guard resolves userId
  |                                              |  2. UPDATE refresh_tokens SET revokedAt=now()
  |                                              |     WHERE userId = $1 AND revokedAt IS NULL
  |  204 No Content                              |
  |<---------------------------------------------|
```

All active sessions on all devices are revoked — the mobile app calls this on explicit "Log out".

## Error-code catalog

Stable codes returned in `response.errorCode`. Mobile translates these via `errors.<CODE>` i18n keys.

| HTTP | errorCode | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Zod / class-validator rejected the body (includes `issues[]`) |
| 400 | `BAD_REQUEST` | Generic bad request |
| 401 | `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `AUTH_INVALID_REFRESH_TOKEN` | Refresh token missing / expired / revoked |
| 401 | `AUTH_ACCOUNT_DISABLED` | `User.status = DISABLED` |
| 401 | `AUTH_UNAUTHORIZED` | Missing / invalid Bearer token |
| 403 | `FORBIDDEN` | Authenticated but not owner of the resource |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `AUTH_EMAIL_TAKEN` | `/auth/register` with an email that already exists |
| 409 | `CONFLICT` | Generic unique-key conflict |
| 422 | `UNPROCESSABLE` | Business-rule violation (e.g. endTime ≤ startTime) |
| 429 | `RATE_LIMIT_EXCEEDED` | Throttler fired |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled — logged with stack server-side |

Controllers can override the code by throwing `new BadRequestException({ message, errorCode: 'MY_CODE' })`.

## Password policy

Enforced in `@planner/shared` → `RegisterSchema`:
- minimum 8 characters
- server rejects requests failing the schema with `VALIDATION_FAILED`

Stored as bcrypt with cost factor 10. Server never logs password, hash, or tokens.

## What the mobile does

1. **On login / register** — store `accessToken` in memory + AsyncStorage and `refreshToken` in SecureStore. See `apps/mobile/src/services/auth/token-store.ts`.
2. **On every request** — attach `Authorization: Bearer <accessToken>` via the API client.
3. **On 401 + `auth:true`** — `client.ts` calls `/auth/refresh` transparently, retries the original request once, then surfaces the error if refresh also fails. A lock (`refreshInFlight`) prevents a refresh stampede when many calls race.
4. **On logout** — POST `/auth/logout`, clear both token stores, reset Zustand state to `unauthenticated`.

## Threat notes

- **DB dump leak** — refresh tokens are stored as sha256 hashes, so they're unusable. Access tokens live only in the client.
- **XSS on mobile** — tokens live in SecureStore (iOS Keychain / Android Keystore); AsyncStorage is used only for the short-lived access token.
- **CSRF** — JWT in Authorization header (not cookies) defeats classic CSRF.
- **Brute-force** — `/auth/login` is 10/min/IP. Tighten via env if needed.
- **Token replay after rotation** — each refresh token can be used exactly once; the next `/auth/refresh` with the old one returns `AUTH_INVALID_REFRESH_TOKEN`.
