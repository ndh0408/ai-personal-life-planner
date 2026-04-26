# AI Settings UX — Round 20.5

**Goal:** non-technical users should never see provider/baseUrl/model
fields. Power users keep the full form behind an "Advanced" toggle.

---

## Surfaces

### 1. `AISetupScreen` (new — `screens/settings/AISetupScreen.tsx`)

The consumer-grade fast path. One input + Test + Save.

**Fields:**
- OpenAI API key (`secureTextEntry`, with show/hide toggle)

**Buttons:**
- `Test and save` — primary
- `Skip for now` — secondary text

**Links:**
- `What is an API key?` → opens openai.com docs
- `Where do I get a key?` → opens platform.openai.com/api-keys

**Behaviour:**
- Calls `POST /user-ai-providers/openai-simple` with `{ apiKey }`.
- On success: invalidates `[user-ai-providers]`, `[user-ai-preferences]`,
  `[dashboard]`, shows success alert, pops back.
- On failure: backend rolls the row back; mobile shows the user-friendly
  error code (`OPENAI_KEY_INVALID` for 401, `AI_PROVIDER_TEST_FAILED`
  for transport / unknown).
- Only OpenAI; `baseUrl` & `model` are server-controlled.

### 2. `AiProviderSettingsScreen` (rewritten)

Three sections, top-to-bottom:

1. **Hero card** — when no providers exist, "Enable AI to get started"
   + `Add OpenAI key` CTA → `AISetup`. When an OpenAI provider exists,
   show masked key, last-tested time, status badges, and `Test` /
   `Replace` / `Remove` buttons.
2. **Preferences** — `useOwnApiKey` + `fallbackToGlobalProvider`
   toggles (only shown when at least one provider exists).
3. **Advanced** — collapsed `Switch`. Expanding reveals the full
   multi-provider list (NVIDIA, Gemini, Anthropic, OpenRouter, Custom)
   plus the legacy `Add provider` button → `AddAiProvider`.

### 3. Dashboard hero card

When the user has zero providers, the home screen surfaces a primary-
toned `HeroCta` "Enable AI to get started" → `AISetup`. Disappears
once any provider exists.

---

## Backend

### New endpoint

`POST /user-ai-providers/openai-simple`

**Body:** `{ apiKey: string }` (8–512 chars).

**Behaviour:**
1. Encrypts the key.
2. Inserts a `UserAiProvider` row with:
   - `provider = 'OPENAI'`
   - `name = 'OpenAI'` (auto-deduped)
   - `baseUrl = null` (resolver fills `https://api.openai.com/v1`)
   - `defaultChatModel = OPENAI_DEFAULT_MODEL` env var
   - `isDefault = true`, `isActive = true`
3. If the user has no preference row yet (or this is their first
   provider), upserts `useOwnApiKey = true` so AI features unlock
   immediately.
4. Calls `AiProviderResolverService.testProvider()` upstream.
5. **On test failure**: rolls the row back, clears the preference
   pointer, and returns `{ provider: null, test: { ok: false, errorCode } }`.
   Translates `401 / invalid_api_key / incorrect API key` into
   `OPENAI_KEY_INVALID`; everything else into `AI_PROVIDER_TEST_FAILED`.
6. **On test success**: marks `lastTestStatus = SUCCESS` and returns
   `{ provider, test: { ok: true } }`.

**Throttle:** 5 requests / minute (each call costs upstream tokens).

### Env

`OPENAI_DEFAULT_MODEL` (string, default `'gpt-4o-mini'`) — bumpable
without a mobile release.

---

## Error mapping

Mobile maps the following backend codes to user-friendly i18n strings:

| code | en | vi |
|------|----|-----|
| `AI_PROVIDER_NOT_CONFIGURED` | "AI is not enabled yet…" | "Bạn chưa bật AI…" |
| `OPENAI_KEY_INVALID` | "This API key is invalid…" | "API key không hợp lệ…" |
| `AI_PROVIDER_TEST_FAILED` | "Could not connect to AI…" | "Không thể kết nối AI…" |
| `AI_DAILY_LIMIT_REACHED` | "You have reached today's AI…" | "Hôm nay bạn đã dùng hết…" |
| `EMAIL_VERIFICATION_RESEND_RATE_LIMITED` | "Verification email…" | "Bạn vừa gửi…" |
| `CONCURRENT_WRITE` | "This data changed recently…" | "Dữ liệu vừa thay đổi…" |

Mapping is centralised in `apps/mobile/src/i18n/useErrorMessage.ts` —
the hook reads `body.errorCode` and looks up `errors.<code>` in i18n
(falls back to `UNKNOWN_ERROR`).

---

## Manual QA

1. **Fresh user, no providers:**
   - Dashboard shows "Enable AI to get started" hero card.
   - Tapping it opens `AISetup`.
   - Pasting a known-bad key → "API key invalid" alert; no row persists.
   - Pasting a real `sk-...` key → "AI is enabled" alert; goes back.
2. **User with OpenAI provider:**
   - Dashboard hero card disappears.
   - `AiProviderSettings` shows masked key + "Tested 5 minutes ago".
   - Tapping `Replace key` re-opens `AISetup`.
   - Tapping `Remove` confirms then deletes.
3. **Power user wants NVIDIA + OpenAI:**
   - `AiProviderSettings` → flip `Advanced` toggle.
   - Tap `Add provider` → existing form → save NVIDIA.
   - List shows both; can flip default between them.

## Files touched

- `packages/shared/src/schemas/user-ai-provider.schema.ts` — added `QuickOpenAiSetupSchema`.
- `apps/api/src/modules/user-ai-providers/user-ai-provider.service.ts` — added `createOpenAiSimple`.
- `apps/api/src/modules/user-ai-providers/user-ai-providers.controller.ts` — added `POST openai-simple` route.
- `apps/api/src/config/env.validation.ts` — added `OPENAI_DEFAULT_MODEL`.
- `apps/mobile/src/services/api/user-ai-providers.api.ts` — added `createOpenAiSimple`.
- `apps/mobile/src/screens/settings/AISetupScreen.tsx` — new.
- `apps/mobile/src/screens/settings/AiProviderSettingsScreen.tsx` — rewritten.
- `apps/mobile/src/screens/dashboard/DashboardScreen.tsx` — hero CTA + Quick Capture entry.
- `apps/mobile/src/navigation/RootNavigator.tsx`, `types.ts` — `AISetup` route.
- `apps/mobile/src/i18n/locales/{en,vi}.json` — `aiSetup.*` block + new error codes.
