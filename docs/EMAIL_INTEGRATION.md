# Email Integration — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/communication/connected-accounts.service.ts`, `email.service.ts`, `ai-communication.service.ts`, `apps/mobile/src/screens/communication/{ConnectedAccounts,EmailAssistant}Screen.tsx`.
**Companion to:** [COMMUNICATION_ASSISTANT.md](./COMMUNICATION_ASSISTANT.md), [PRIVACY_COMMUNICATION_DATA.md](./PRIVACY_COMMUNICATION_DATA.md).

## 1. Data the app reads

Three escalating tiers, enforced as a **server-side ladder** in `CommunicationSettingsService.updateSettings`:

| Tier | Toggle | Stored | Sent to AI |
|------|--------|--------|------------|
| 1 | `emailMetadataSync` (default ON when `emailAssistantEnabled=true`) | `from`, `subject`, `receivedAt`, `isRead`, threadId, externalId | from + subject + receivedAt only |
| 2 | `emailSnippetSync` (requires tier 1) | + Gmail/Outlook short snippet | + snippet |
| 3 | `emailFullContentAnalysis` (requires tier 2) | NOT persisted | full body, but **only when user taps Analyze on a specific email** |

Tier 3 is **request-scoped** — body is never stored, never logged, and the analyze endpoint passes it transiently to AI. The `EmailItem` row keeps only the AI-produced summary, not the body.

## 2. Privacy at the API boundary

- `EmailService.list()` and `getById()` strip `snippet` from the response when `emailSnippetSync=false`, even if a row was stored under an earlier setting.
- DTO mapper `toConnectedAccountDto` never returns `encryptedAccessToken` / `encryptedRefreshToken` — they don't appear in the response shape at all.
- Tokens are AES-256-GCM via `EncryptionService` (same key used for BYOK).

## 3. OAuth flow (shape today, full wiring in v1.3)

```
Mobile  ──POST /api/connected-accounts/gmail/start──►  API
                                                         │
                                                         ▼
                                                generates HMAC-bound state
                                                returns { authorizeUrl, state }
        ◄────────────────── { authorizeUrl, state } ────
        Linking.openURL(authorizeUrl)
        ▼
Provider sign-in page → redirect to /api/connected-accounts/gmail/callback?state=...&code=...
                                                         │
                                                         ▼
                                                validates state HMAC
                                                v1.2: throws OAUTH_NOT_CONFIGURED
                                                v1.3: token exchange → upsertAfterTokenExchange
```

State token is `<nonce>.<hmac-sha256(userId:provider:nonce, AI_PROVIDER_ENCRYPTION_KEY)[:32]>`, kept in an in-memory map with 10-minute TTL. Production should move to Redis with `SETEX`.

The token exchange itself is a stub in v1.2 — the API throws `OAUTH_NOT_CONFIGURED` rather than silently failing, so we never persist a partially-validated account. Mobile catches this and shows the "coming in v1.3" toast.

## 4. AI analysis

`AiCommunicationService.analyzeEmail(userId, email, body?)`:

1. Reads `CommunicationSetting` and `localeService.forUser`.
2. If `emailAssistantEnabled=false`, returns deterministic fallback with `disabledByPrivacy: true`.
3. Builds a prompt with `<email-from>`, `<email-subject>`, `<email-received-at>`. Adds `<email-snippet>` only if `emailSnippetSync=true`. Adds `<email-body>` only if `emailFullContentAnalysis=true` AND the caller passed `body`.
4. Calls AI through `AiProviderResolverService` (BYOK or global), validates JSON output against `AnalysisSchema`, persists `isImportant / needsReply / hasDeadline / detectedDeadlineAt / category / aiSummary` back onto the row.
5. On any error → deterministic locale fallback with `usedFallback: true`.

Output shape is locked to v1.2:

```json
{
  "isImportant": true,
  "needsReply": true,
  "hasDeadline": true,
  "detectedDeadlineAt": "2026-04-30T10:00:00.000Z",
  "category": "WORK",
  "summary": "Email này có vẻ cần phản hồi về lịch họp.",
  "suggestedReminder": { "title": "Trả lời email về lịch họp", "remindAt": "2026-04-29T13:00:00.000Z" },
  "usedFallback": false
}
```

`suggestedReminder` is a **suggestion only** — the mobile UI must show it as a card with an explicit "Create reminder" button. Backend never auto-creates reminders from this output.

## 5. Sync stub (v1.2)

`EmailService.syncFor(userId)` counts the user's active connected accounts, logs a stub line, and returns `{ accountsSynced: 0, notImplemented: true }`. Mobile interprets `notImplemented: true` and shows the localised "Sync isn't wired in this build" alert.

The actual Gmail / Outlook fetch + Prisma upsert lands in v1.3 along with the OAuth token exchange — same `EmailService` interface, no caller changes required.

## 6. Manual test plan

1. Settings → Communication → Connect Gmail → expect alert "Email OAuth isn't enabled in this build yet."
2. Settings → Communication → toggle `emailMetadataSync` OFF → confirm `emailSnippetSync` and `emailFullContentAnalysis` cascade OFF + their UI rows go disabled.
3. Settings → Communication → try to enable `emailFullContentAnalysis` while `emailSnippetSync` is OFF → expect 400 INVALID_PROVIDER_CONFIG.
4. With a manually-seeded `EmailItem` row in DB, GET `/api/emails` → confirm `snippet: null` when toggle is off, `snippet: '...'` when on.
5. POST `/api/emails/:id/analyze` with `emailAssistantEnabled=false` → expect `{ disabledByPrivacy: true, usedFallback: true }`.
6. Repeat with `emailAssistantEnabled=true` → expect AI-driven analysis OR `usedFallback: true` if AI provider is mock.
