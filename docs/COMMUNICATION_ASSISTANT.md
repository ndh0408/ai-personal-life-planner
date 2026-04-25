# Communication Assistant — LifeOS AI

**Audience:** product, design, security review, store reviewers.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [PERMISSIONS.md](./PERMISSIONS.md), [EMAIL_INTEGRATION.md](./EMAIL_INTEGRATION.md), [MESSAGE_REMINDERS.md](./MESSAGE_REMINDERS.md), [AI_COMPANION_MEMORY.md](./AI_COMPANION_MEMORY.md), [ANDROID_NOTIFICATION_IMPORT_RISK.md](./ANDROID_NOTIFICATION_IMPORT_RISK.md), [PRIVACY_COMMUNICATION_DATA.md](./PRIVACY_COMMUNICATION_DATA.md).
**Source of truth in code:** `apps/api/src/modules/communication/*`, `apps/mobile/src/screens/communication/*`, schema Section M.

## 1. Why this exists

LifeOS AI should help users keep up with **email + messages + commitments** the same way a thoughtful assistant would: noticing what needs a reply, when something has a deadline, and reminding them to follow up — without ever being a surveillance app.

## 2. Top-level guarantees (what this module **does NOT** do)

- ❌ Never reads messages from third-party apps (Messenger / Zalo / iMessage / SMS) on either platform.
- ❌ Never opens the microphone in the background. Voice notes activate only while a record button is held.
- ❌ Never auto-sends an email or message on the user's behalf.
- ❌ Never auto-creates a task / reminder from AI suggestions — every AI proposal needs an explicit user confirm.
- ❌ Never stores OAuth tokens in plaintext (AES-256-GCM via `EncryptionService`).
- ❌ Never logs OAuth tokens or email body content.
- ❌ Never bypasses the OS sandbox or uses Accessibility services.
- ❌ Never reads OTP / banking notifications even when the optional Android Notification Listener is enabled (denylist + skipped categories — see ANDROID_NOTIFICATION_IMPORT_RISK.md).

## 3. Surface area in v1.2

```
Settings → Communication assistant
  ├── CommunicationSettings (8 toggles, snippet-ladder enforced)
  ├── Connected accounts (Gmail / Outlook OAuth shape)
  ├── Email triage (filter Important / Needs reply / Deadline / Bills / Work)
  ├── Follow-up reminders (Email + Message tabs)
  │   └── Add message reminder (manual)
  └── AI memory (consent + filter + clear-all)
```

Backend module `CommunicationModule` exposes 23 endpoints under `/api/communication/...`, `/api/connected-accounts/...`, `/api/emails/...`, `/api/email-reminders/...`, `/api/message-reminders/...`, `/api/ai-memory/...`. All are JwtAuthGuard'd; ownership scoped to JWT subject.

## 4. Status of each feature in v1.2

| Feature | Status | Notes |
|---------|--------|-------|
| Communication settings | ✅ Shipped | 8 toggles, snippet-ladder enforced server-side. |
| Memory consent (`MemoryConsent`) | ✅ Shipped | 4 toggles; `allowMemory` master + 3 source-specific. |
| Email triage UI | ✅ Shipped | Lists from `EmailItem`; filter chips wired. |
| Email mark-done / status patch | ✅ Shipped | `PATCH /api/emails/:id/status`. |
| Email AI analyze | ✅ Shipped | `POST /api/emails/:id/analyze` — privacy-aware (gates on toggles), JSON-validated, falls back deterministically. |
| Email reminders + Message reminders CRUD | ✅ Shipped | Owner-scoped, status transitions, manual creation. |
| AI Companion memory CRUD + clear-all | ✅ Shipped | Sensitive types (HEALTH/FINANCE/RELATIONSHIP) require explicit user-confirmation. |
| Connected accounts (OAuth shape) | ✅ Shipped | OAuth start returns provider authorize URL with HMAC-bound CSRF state. |
| OAuth token exchange | 🚧 v1.3 | `completeOAuth` throws `OAUTH_NOT_CONFIGURED` until Google/Microsoft client IDs are wired. |
| Email upstream sync (Gmail / Outlook fetch) | 🚧 v1.3 | `EmailService.syncFor` returns `{ accountsSynced: 0, notImplemented: true }`. Mobile shows "coming in v1.3" toast. |
| Voice note record + transcribe | 🚧 v1.3 | Toggle exists in `MemoryConsent.allowVoiceNotesForAI`; mic activation flow lands in v1.3. |
| Android Notification Listener import | 🚧 Documented as risky | See `ANDROID_NOTIFICATION_IMPORT_RISK.md`. Not wired in v1.2. |

## 5. Test plan (manual)

See per-feature docs (`EMAIL_INTEGRATION.md`, `MESSAGE_REMINDERS.md`, `AI_COMPANION_MEMORY.md`).
