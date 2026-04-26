# LifeOS AI — API Contract

Base URL (dev): `http://localhost:4000/api`

All requests/responses are JSON. Authenticated routes require
`Authorization: Bearer <accessToken>`. Schemas are sourced from
[`@lifeos/shared`](../packages/shared) — when in doubt, the Zod schema is the
source of truth.

This contract covers MVP. Endpoints marked **(round 1+)** are not implemented in
the foundation round but are listed so the mobile team can stub them.

---

## Conventions

- Timestamps: ISO-8601 strings (`2026-04-26T13:42:00.000Z`).
- IDs: opaque CUIDs, never numeric.
- Money: smallest currency unit, integer (`75000` = 75 000 ₫).
- Errors:
  ```json
  { "error": { "code": "invalid_credentials", "message": "Email or password is incorrect" } }
  ```
- Rate limit: default 100 req / 60 s per IP+user (configurable via env).

---

## Health

### `GET /health`
Public. Returns service + db status.

```json
{
  "status": "ok",
  "service": "lifeos-api",
  "version": "0.1.0",
  "db": "ok",
  "uptimeSec": 412,
  "timestamp": "2026-04-26T13:42:00.000Z"
}
```

---

## Auth (round 1)

### `POST /auth/register`
Body: `RegisterRequestSchema`.
Response 201: `AuthResponseSchema`.

### `POST /auth/login`
Body: `LoginRequestSchema`.
Response 200: `AuthResponseSchema`.
Errors: `invalid_credentials` (401).

### `POST /auth/refresh`
Body: `{ "refreshToken": "..." }`.
Response 200: `AuthTokensSchema` (rotated — old refresh token is revoked).
Errors: `invalid_token` (401), `token_revoked` (401), `token_expired` (401).

### `POST /auth/logout`
Auth required. Body: `{ "refreshToken": "..." }`.
Marks the session revoked. Response 204.

### `GET /auth/me`
Auth required. Response 200: `UserPublicSchema`.

---

## AI credentials (round 1)

### `POST /ai/credentials`
Auth required. Body: `SetOpenAiKeyRequestSchema`.
Server flow:
1. Format check.
2. Live test (`openai.models.list`) — if it fails, return `invalid_key` /
   `quota_exceeded` / `network_error` (422 / 402 / 503). **No row is written.**
3. AES-256-GCM encrypt → upsert `AiCredential` for the user.

Response 200: `AiCredentialStatusSchema` (with `hasKey: true`, `lastTestOk: true`).

### `GET /ai/credentials`
Auth required. Response 200: `AiCredentialStatusSchema`.
Never includes the key, the ciphertext, the IV, or the auth tag.

### `POST /ai/credentials/test`
Auth required. Re-runs the live test against the stored key.
Response 200: `TestKeyResponseSchema`.

### `DELETE /ai/credentials`
Auth required. Hard-deletes the row. Response 204.

---

## Capture (round 2)

### `POST /capture/parse`
Auth required. Body:
```json
{ "text": "ăn cơm tấm 75k trưa nay", "tz": "Asia/Ho_Chi_Minh" }
```
Server calls OpenAI with structured output, returns:
```json
{
  "kind": "meal" | "task" | "expense" | "sleep" | "mood" | "calendar" | "unknown",
  "confidence": 0.92,
  "fields": { ... },
  "previewText": "🍚 Bữa ăn — Cơm tấm — 75 000 ₫ — 12:00"
}
```

### `POST /capture/confirm`
Auth required. Body:
```json
{ "kind": "meal", "fields": { ... } }
```
Inserts into the matching feature table; returns the created record + a
typed envelope.

---

## Feature CRUD (round 3+)

Each module exposes a thin REST surface:

```
GET    /tasks?range=today
POST   /tasks
PATCH  /tasks/:id
DELETE /tasks/:id

GET    /expenses?range=week
POST   /expenses
…etc for /meals, /sleep, /mood, /calendar
```

All bodies are `Schema.parse`d with zod. All `GET` responses include a
`syncCursor` to support cheap incremental refresh later.

---

## What this contract does NOT include

- File uploads (planned phase 2).
- WebSocket / SSE (notifications are polled in MVP).
- Webhooks.
- Public API for third parties.
