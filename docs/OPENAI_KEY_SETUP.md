# LifeOS AI — OpenAI Key Setup

How a user's OpenAI API key gets from the onboarding screen into encrypted
storage, and how every later AI call uses it without ever putting the
plaintext on disk or in a log.

> Crypto details live in [SECURITY_PRIVACY.md](./SECURITY_PRIVACY.md).
> Schema fields live in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md#ai-credentials).

---

## The four endpoints

All require `Authorization: Bearer <accessToken>`.

```
POST   /api/ai-key/setup-openai   { apiKey }       → AiKeyStatus
POST   /api/ai-key/test           (no body)        → TestAiKeyResponse
GET    /api/ai-key/status                          → AiKeyStatus
DELETE /api/ai-key                                 → 204
```

`AiKeyStatus`:
```ts
{
  enabled: boolean,
  provider: 'OPENAI' | null,
  maskedApiKey: string | null,   // "sk-•••••••••x9aB"
  lastTestStatus: 'SUCCESS' | 'FAILED' | null,
  lastTestedAt: string | null,
}
```

`TestAiKeyResponse`:
```ts
{
  status: 'SUCCESS' | 'FAILED',
  maskedApiKey: 'sk-•••••••••x9aB',
  message?: string,    // dev-friendly hint for the FAILED case
}
```

The raw `apiKey` is never echoed back, in any field, by any endpoint.

---

## What `setup-openai` does, end to end

```
mobile                       api                                  openai
  │ POST /ai-key/setup-openai │                                      │
  │  { apiKey: "sk-..." }     │                                      │
  │ ─────────────────────────▶│                                      │
  │                           │ Zod: format check (sk-, length)      │
  │                           │ fingerprint(): { last4, masked }     │
  │                           │ live test against /v1/models         │
  │                           │ ────────────────────────────────────▶│
  │                           │ ◀──── 200 / 401 / 429 / 5xx ────────│
  │                           │ EncryptionService.seal(apiKey)       │
  │                           │   → "v1:gcm:<iv>:<tag>:<ct>"         │
  │                           │ UserAiKey.upsert({                   │
  │                           │   encryptedApiKey,                   │
  │                           │   apiKeyLast4, maskedApiKey,         │
  │                           │   baseUrl, defaultModel,             │
  │                           │   lastTestStatus,                    │
  │                           │   lastTestedAt,                      │
  │                           │   isActive: true })                  │
  │  200 + AiKeyStatus        │                                      │
  │ ◀─────────────────────────│                                      │
```

Notes:

- **The key is stored even if the live test fails.** This is a deliberate UX
  choice: an OpenAI 5xx blip shouldn't force the user to retype a 51-character
  key. The status response surfaces `lastTestStatus: FAILED` so the UI can
  show a yellow indicator + a "Test again" button.
- The live probe hits `models.list` because it is the cheapest authenticated
  endpoint — read-only, no token cost.
- Hard timeout: **8 seconds**. Aborted tests come back as `FAILED` with the
  message *"Hết thời gian kết nối tới OpenAI."*.
- `baseUrl` and `defaultModel` are sourced from API env (`OPENAI_BASE_URL`,
  `OPENAI_DEFAULT_MODEL`). The mobile client never sends them.

## Test the stored key

`POST /api/ai-key/test` decrypts the row in memory, repeats the same probe
against `models.list`, writes back `lastTestStatus`, and returns:

```json
{ "status": "SUCCESS", "maskedApiKey": "sk-•••••••••x9aB" }
```

Provider-error mapping:

| OpenAI status | What we return | Surfaced message |
|---|---|---|
| 200 | `SUCCESS` | — |
| 401 | `FAILED` | "API key không hợp lệ." |
| 429 | `FAILED` | "API key đã hết quota." |
| 5xx | `FAILED` | "OpenAI đang gặp sự cố. Thử lại sau." |
| Aborted | `FAILED` | "Hết thời gian kết nối tới OpenAI." |
| Anything else | `FAILED` | "Không thể kết nối tới OpenAI." |

We **never** echo the OpenAI error message verbatim — provider responses
sometimes contain fragments of the request that may include the key.

## Status

Read-only. Returns the same shape as `setup-openai`. If no row, or the row
is `isActive: false`, returns the disabled snapshot:

```json
{ "enabled": false, "provider": null, "maskedApiKey": null,
  "lastTestStatus": null, "lastTestedAt": null }
```

## Delete

`DELETE /api/ai-key` is a hard delete (`prisma.userAiKey.deleteMany`). After
this call the user is back to the disabled state and the next AI feature
will refuse to run with `AI_KEY_NOT_FOUND` until they re-enter a key.

---

## How the key is encrypted

`EncryptionService.seal(plaintext)` produces a single packed string:

```
v1:gcm:<iv_base64>:<authTag_base64>:<ciphertext_base64>
```

- AES-256-GCM, 32-byte key from `USER_AI_KEY_ENCRYPTION_KEY` env (64 hex chars).
- Fresh 12-byte IV per call (`randomBytes(12)`).
- 16-byte auth tag stored alongside; tampering at any byte is rejected.
- The `v1:gcm` prefix lets us migrate to a new algorithm later without
  ambiguity (a future `v2:` payload is a different code path).

`open(packed)` does the inverse, refusing any payload it doesn't recognise.

`fingerprint(plaintextKey)` returns:

```ts
{ last4: "x9aB", masked: "sk-•••••••••x9aB" }
```

Both fields are written to the DB at setup time so reads can render the UI
without ever decrypting.

## Logging discipline

- The service logs at most: `userAiKey saved (userId=…, last4=…, test=OK|FAIL)`.
- The `apiKey`, `encryptedApiKey`, `maskedApiKey`, OpenAI raw error, and
  request body never appear in any log line.
- Production logs are redacted by the standard pino-style key list (see
  [SECURITY_PRIVACY.md §Logging](./SECURITY_PRIVACY.md#logging--redaction)).

---

## Mobile UX rules (round 1 will implement)

These rules are not optional — see [UX_PRINCIPLES.md](./UX_PRINCIPLES.md).

- **The screen never asks for "provider", "model", or "baseURL".** They are
  set server-side. Advanced users can change `defaultModel` in a hidden
  Developer panel later.
- The key field has a show/hide eye toggle (default hidden).
- Paste is the primary action — mobile users won't type a 51-char string.
- After a successful save, **clear the field** so the raw key is not in
  React state any longer than necessary.
- Offer a "Tôi chưa có key" link that opens a step-by-step modal with
  screenshots, not a wall of text.
- Errors are user-facing strings, never the OpenAI error JSON.

---

## What's not done (parked)

- Multi-provider (Anthropic, Google, Ollama) — phase 2 per
  [PRODUCT_SPEC §6](./PRODUCT_SPEC.md#6-những-thứ-không-làm-ở-mvp).
- Per-user model selection — `defaultModel` is settable server-side now,
  surfaced in mobile only via the hidden Developer panel.
- Key rotation by Anthropic-style scheduled rotation — N/A; rotation here
  means the user re-runs `setup-openai`.
- Metering / per-user cost tracking — `AiUsageLog` table exists; the
  dashboard will land in a later round.
