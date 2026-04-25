# User AI Providers — Bring-Your-Own-Key (BYOK)

**Status:** v1.1 (added 2026-04-25). Replaces the v1.0 "global-only AI"
behaviour while keeping it as a fallback.

LifeOS AI now lets each user supply their own AI API key and model id.
When enabled, every AI feature for that user (chat, planner, meal,
finance, daily/weekly review, recommendations) is served by the
provider the user picked, billed against the user's own account.

The original env-configured global provider stays in place and is still
used (a) for users who haven't opted in, and (b) as an automatic
fallback when a user-supplied key fails — both behaviours are toggles
the user controls.

---

## 1. Architecture overview

```
┌─────────────────────┐    HTTPS    ┌────────────────────────────┐
│ Mobile (Expo)       │ ──────────► │ NestJS API                 │
│ ──                  │             │ ──                         │
│ AiProviderSettings  │             │ /api/user-ai-providers     │
│ AddAiProvider       │             │ /api/user-ai-preferences   │
│ EditAiProvider      │             │                            │
│                     │             │ AiProviderResolverService  │
│ • Toggles BYOK on/off            │   resolves per-request:    │
│ • Adds provider config            │   1. user provider         │
│ • Tests connection                │   2. fallback to global    │
│ • API key sent ONCE over HTTPS    │   3. else 503/400          │
└─────────────────────┘             │                            │
                                    │ EncryptionService (AES-GCM)│
                                    │ • Encrypts at rest        │
                                    │ • Decrypts only at call   │
                                    │                            │
                                    │ Postgres                   │
                                    │ • user_ai_providers        │
                                    │ • user_ai_preferences      │
                                    └────────────────────────────┘
                                                │
                                                ▼
                              ┌──────────────────────────────────┐
                              │ Upstream AI                      │
                              │ NVIDIA / OpenAI / Gemini /       │
                              │ Anthropic / OpenRouter / Custom  │
                              └──────────────────────────────────┘
```

The mobile app **never** calls AI providers directly — every request is
proxied through the API so we can decrypt the right key, enforce
ownership and rate-limits, and emit structured audit logs.

---

## 2. Security design

| Concern | How it's handled |
|---------|------------------|
| Key submission | HTTPS only. The mobile API client uses Bearer JWT and `Content-Type: application/json` — no other transport. |
| Key storage | AES-256-GCM, packed `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`. Encryption key from env `AI_PROVIDER_ENCRYPTION_KEY`. |
| Plaintext lifetime | Only inside `create / update / test / completeForUser` stack frames; never assigned to a service field, never cached. |
| Key display | Only `apiKeyLast4` is stored plaintext (4 chars). The DTO mapper synthesises a masked form `sk-****cdef`. The full key never leaves the API. |
| Logs | Logger lines record `provider`, `model`, `task`, `userScope`, `usedFallback`, `success/failure` — never the key, prompt, or response body. The `briefAiError()` helper truncates upstream error messages at 200 chars and strips JSON-like blobs that some SDKs append. |
| Authn / IDOR | `JwtAuthGuard` on every endpoint; every Prisma query filters by `userId` from the JWT subject. Cross-user IDOR is covered by `user-ai-provider.service.spec.ts`. |
| Rate-limit | Class-level `@Throttle(30/min)`; create `@Throttle(10/min)`; test `@Throttle(6/min)` per user IP — providers can deauth keys on burst, so we throttle on our side too. |
| Tampering | GCM auth tag rejects any modified ciphertext at decrypt time (covered by `encryption.service.spec.ts`). |
| Mobile UX | Key field is `secureTextEntry` + `textContentType="password"` (disables iOS keychain caching). Form state is wiped after submit; the screen unmount effect resets `apiKey` even if the user navigates away. AsyncStorage is **never** used for the API key. |

---

## 3. Encryption details

* Algorithm: **AES-256-GCM**
* IV: 12 random bytes per encryption (NIST recommendation)
* Auth tag: 16 bytes
* Wire format: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>` — the `v1:` prefix
  reserves room for a future algorithm change without ambiguity.
* Key sources accepted by `EncryptionService`:
  * 64-char hex string → decoded directly to 32 raw bytes (recommended;
    use `openssl rand -hex 32`).
  * 32+ char passphrase → hashed via SHA-256 to 32 bytes (dev only).
* Production fail-fast: env validation rejects start-up if
  `AI_PROVIDER_ENCRYPTION_KEY` is missing or shorter than 32 chars in
  `NODE_ENV=production`.
* Dev fallback: with no key set in dev/test, an **ephemeral random**
  key is generated. Stored secrets do **not** survive a restart in this
  mode — by design, because no plaintext key can leak from `.env`.

### Rotating the encryption key

Phase-1 rotation is intentionally simple and destructive:

1. Pick a maintenance window.
2. `psql > UPDATE user_ai_providers SET encrypted_api_key = '', api_key_last4 = '----';`
   (or `DELETE FROM user_ai_providers;` if you'd rather start clean).
3. Set the new `AI_PROVIDER_ENCRYPTION_KEY` and restart.
4. Notify users to re-enter their keys.

A non-destructive rotation (re-encrypt existing rows under the new key)
is on the roadmap; it requires a migration script that decrypts under
the old key and re-encrypts under the new key in a single transaction.
**TODO** — track in `notes/RUNBOOK_KEY_ROTATION.md` (not yet authored).

---

## 4. Supported providers

| Provider | Default base URL | Transport | Notes |
|----------|------------------|-----------|-------|
| `OPENAI` | `https://api.openai.com/v1` | OpenAI Chat Completions | Keys start with `sk-`. |
| `NVIDIA` | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible | Keys start with `nvapi-`. Browse models on NVIDIA API Catalog. |
| `OPENROUTER` | `https://openrouter.ai/api/v1` | OpenAI-compatible | Keys start with `sk-or-`. Sends optional `HTTP-Referer` / `X-Title` headers from `OPENROUTER_HTTP_REFERER` / `OPENROUTER_X_TITLE` env vars. |
| `CUSTOM_OPENAI_COMPATIBLE` | *(user-supplied)* | OpenAI-compatible | `baseUrl` is **required**. Use any self-hosted vLLM / Ollama / LM Studio endpoint that speaks `/chat/completions`. |
| `ANTHROPIC` | `https://api.anthropic.com/v1` | Anthropic Messages | Keys start with `sk-ant-`. Use a model id like `claude-opus-4-7`. |
| `GEMINI` | `https://generativelanguage.googleapis.com/v1beta` | Gemini `generateContent` REST | Vertex AI variant + tool use are TODO. |

Mobile never sees these tables — see `app.config.ts` and the bundle scan
in `SECURITY_AUDIT_REPORT.md` (mobile bundle has zero references to AI
provider keys or endpoints).

### Model selection

Each `UserAiProvider` row has six per-task fields. The resolver picks
the model in this order:

```
task model (e.g. defaultPlannerModel)
  → defaultChatModel
  → AI_MODEL env (global default, last resort)
```

If none of those is set, the resolver throws `INVALID_PROVIDER_CONFIG`
and the request falls back to the global provider (or returns
`USER_AI_PROVIDER_FAILED` if fallback is disabled).

---

## 5. API surface

All endpoints require a Bearer JWT and operate on the JWT subject's rows.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET    | `/api/user-ai-providers` | — | `UserAiProviderDto[]` |
| POST   | `/api/user-ai-providers` | `CreateUserAiProviderInput` | `UserAiProviderDto` |
| PUT    | `/api/user-ai-providers/:id` | `UpdateUserAiProviderInput` | `UserAiProviderDto` |
| DELETE | `/api/user-ai-providers/:id` | — | 204 |
| POST   | `/api/user-ai-providers/:id/test` | — | `UserAiProviderTestResultDto` |
| GET    | `/api/user-ai-preferences` | — | `UserAiPreferenceDto` |
| PUT    | `/api/user-ai-preferences` | `UpdateUserAiPreferenceInput` | `UserAiPreferenceDto` |

`UserAiProviderDto` is **never** returned with a raw `apiKey` field.
Only `apiKeyLast4` (plaintext, 4 chars) and `maskedApiKey`
(synthesised, e.g. `sk-****cdef`) are exposed.

---

## 6. How fallback works

```
         useOwnApiKey  ┌── pickUserProvider(task)
              │        │     ├ defaultProviderId (preference)
              ▼        │     ├ isDefault=true row
              true ────┘     └ first active row
              │
              └── decrypt → ephemeral provider client → orchestrator.complete
                                       │
                                       ▼
                       OK ────────────► return { userScope:'user' }
                       ERR ──┐
                             │
                             ▼
                    fallbackToGlobal?
                             │
                       yes ──┴► global provider → return { userScope:'global', usedFallback:true }
                       no  ──► throw ServiceUnavailable USER_AI_PROVIDER_FAILED

         useOwnApiKey=false → straight to global
         no global usable in prod → throw AI_PROVIDER_NOT_CONFIGURED
```

The mobile error mapping (`apps/mobile/src/i18n/useErrorMessage.ts`)
has translations for `AI_PROVIDER_NOT_CONFIGURED`,
`USER_AI_PROVIDER_FAILED`, `AI_PROVIDER_TEST_FAILED`, and
`INVALID_PROVIDER_CONFIG` in `vi` + `en`.

---

## 7. Required environment variables

| Var | Required | What it does |
|-----|----------|--------------|
| `AI_PROVIDER_ENCRYPTION_KEY` | **Yes in production** (refused on boot if missing). Recommend `openssl rand -hex 32`. | AES-256-GCM key for at-rest encryption of every `UserAiProvider.encryptedApiKey`. |
| `AI_PROVIDER` | yes | Global provider used as fallback (`mock` / `anthropic` / `openai`). |
| `AI_API_KEY` | when not mock | Global provider key. |
| `AI_MODEL` | yes | Default model for global provider; also the last-resort model when a user provider has no per-task model set. |
| `OPENROUTER_HTTP_REFERER` | optional | Sent only when a user provider type is `OPENROUTER`. |
| `OPENROUTER_X_TITLE` | optional | Same as above. |

`.env.example`, `.env.production.example`, and
`docker-compose.production.yml` all list these. Production stack will
fail to start if encryption key is missing.

---

## 8. Production checklist

- [ ] `AI_PROVIDER_ENCRYPTION_KEY` set, ≥ 64 hex chars, not committed.
- [ ] Backup script (`scripts/backup-db.sh`) covers `user_ai_providers`
      and `user_ai_preferences` (it already dumps the full DB).
- [ ] Verified that `GET /api/user-ai-providers` only returns the
      caller's rows (covered by `user-ai-provider.service.spec.ts`).
- [ ] Verified that the `encryptedApiKey` column body is **never**
      logged (resolver and CRUD service log only metadata).
- [ ] Verified that the mobile bundle has zero references to provider
      keys (`grep -RIn 'sk-' apps/mobile/src/dist` against a release
      build returns nothing relevant).
- [ ] If you change `AI_PROVIDER_ENCRYPTION_KEY`, follow §3.

---

## 9. Roadmap (post-1.1)

- Non-destructive key rotation script.
- Per-task usage metering (per-user token counters).
- Provider-side usage cache (cost dashboards).
- Streaming responses for chat (currently all completions are non-streaming).
- Vertex AI for `GEMINI`, plus tool-use mode for both Anthropic and Gemini.
