# Privacy — Communication Data

**Audience:** legal, security review, store reviewers, the user reading the app's privacy disclosures.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [APP_STORE_PRIVACY_READINESS.md](./APP_STORE_PRIVACY_READINESS.md), [COMMUNICATION_ASSISTANT.md](./COMMUNICATION_ASSISTANT.md).

## 1. Plain-language summary

LifeOS AI's communication features (email triage + reminders + AI memory) only see what the user has explicitly turned on. The app does NOT read messages from other apps. The app does NOT listen on the microphone in the background. The app does NOT track the device.

## 2. Per-data-type contract

| Data | Source | Stored? | Sent to AI? | User control |
|------|--------|---------|-------------|---------------|
| Email metadata (from / subject / time) | Gmail / Outlook OAuth | YES (when `emailMetadataSync=true`) | YES | Toggle off in Settings → Communication. |
| Email snippet | Gmail / Outlook OAuth | YES (when `emailSnippetSync=true`) | YES | Snippet ladder — requires metadata. |
| Email body (full content) | Gmail / Outlook OAuth | NO — never persisted | YES, only on user-tapped Analyze (when `emailFullContentAnalysis=true`) | Snippet ladder — requires snippet. Off by default. |
| OAuth access + refresh tokens | Provider | YES, AES-256-GCM-encrypted at rest, never returned to client | NO | Disconnect to wipe. |
| Email reminders | App | YES | NO (reminder body is the user's own typing) | CRUD in app. |
| Message reminders | User-typed | YES | NO | CRUD in app. |
| Voice note audio | Mic when held | NO — discarded after transcription (v1.3) | The transcript only, when `allowVoiceNotesForAI=true` | Toggle in Memory Consent. |
| AI Companion memory | Chat / voice / email signals (per consent) | YES | YES — re-fed into future AI as user-bounded context | View / edit / delete / clear-all. Sensitive types require explicit user-confirm to write. |
| Notifications from other apps (Android) | OS Notification Listener | Local-only 24h cache when wired | NO upload of raw notification | Off by default. See `ANDROID_NOTIFICATION_IMPORT_RISK.md`. |
| Notifications on iOS | n/a — Apple does not expose | NO | NO | Manual-only by platform design. |

## 3. What we do NOT do

- ❌ Read SMS, iMessage, Messenger, Zalo, WhatsApp, Telegram, or any other third-party messaging app's content.
- ❌ Activate the microphone in the background.
- ❌ Run an AccessibilityService for screen-scraping.
- ❌ Auto-send emails or messages on the user's behalf.
- ❌ Auto-create reminders / tasks from AI suggestions without an explicit user confirm.
- ❌ Log OAuth tokens, email body content, OTP / 2FA notifications, or voice transcripts.
- ❌ Share communication data with third parties (only the user-configured BYOK provider, which is the user's own AI account).

## 4. Encryption

- OAuth access + refresh tokens: AES-256-GCM via `EncryptionService` with key from env `AI_PROVIDER_ENCRYPTION_KEY`. Same envelope format as BYOK keys.
- Email metadata + snippets + AI summaries: stored as-is in Postgres (encryption-at-rest at the volume layer is your storage provider's responsibility — for EU users use a region with at-rest encryption enabled at the Postgres volume).
- Field-level encryption for ultra-sensitive columns (salary, mood notes) lands in v1.3 via `pgcrypto`. Communication data is not on that list because it's all user-action-derived and the user can delete it.

## 5. Logging policy

The backend logger only emits:

- HTTP method + path + status + ms
- AI provider name + model + token counts
- Brief, clipped error class names (via `briefAiError`)

It NEVER emits:

- Email body content, snippet content, or AI summaries
- OAuth tokens (encrypted or otherwise)
- Voice note transcripts
- Notification body / titles from any third-party app
- AI Companion memory content

Verified by `apps/api/src/modules/communication/*` code review and the `briefAiError` regression test.

## 6. Disconnect / delete

Three escalating actions exist:

1. **Disconnect a single account** — `DELETE /api/connected-accounts/:id` — revokes the token row, deletes every cached email tied to that account.
2. **Clear AI memory** — `POST /api/ai-memory/clear` — soft-clears every active memory row (audit trail kept).
3. **Delete account** — `POST /api/privacy/delete-account-request` — schedules permanent cascade-delete of every owned row in 30 days. Cascade is enforced by Prisma `onDelete: Cascade` on every owned table including `connected_accounts`, `email_items`, `email_reminders`, `message_reminders`, `ai_companion_memories`, `communication_settings`, `memory_consents`.

## 7. App store disclosures

When this module ships in the production binary:

- **Apple App Privacy** — add "Email" and "User content (notifications, messages, voice notes)" categories under Data Linked to User → App functionality.
- **Google Play Data Safety** — add "Personal info → Email address", "Messages → Other in-app messages" (the user's reminder titles only), "Audio → Voice or sound recordings" (when v1.3 voice ships).
- See `APP_STORE_PRIVACY_READINESS.md` for the full per-store matrix and Info.plist / `<uses-permission>` strings.

## 8. Roadmap

- v1.3: OAuth token exchange (Gmail + Outlook), email upstream sync, voice note recording with transcription.
- v1.3: Per-row currency on email amounts (when bill detection lands).
- v1.4: Field-level encryption for AI memory `content` via `pgcrypto`.
- v1.4: Differential-privacy aggregates for opt-in diagnostics.
