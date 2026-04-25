# AI Companion Memory — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/communication/companion-memory.service.ts`, `communication-settings.service.ts`, `apps/mobile/src/screens/communication/AICompanionMemoryScreen.tsx`, schema `AICompanionMemory` + `MemoryConsent`.

## 1. What it is

A small, user-controlled set of facts the AI is allowed to remember about the user — things like "prefers light dinners", "tends to skip habit on Sundays", "wants to save 20% of salary". These shape future AI suggestions WITHOUT the AI re-deriving them from raw rows every request.

This is **separate** from `AiPersonalizationMemory` (used by the Privacy Center → ClearAIMemoryScreen). `AICompanionMemory` is the chat/voice-note-driven companion ledger; the older table is for system-derived patterns. v1.3 will merge the two.

## 2. Memory types

```
PREFERENCE / HABIT / GOAL / RELATIONSHIP / WORK_STYLE / COMMUNICATION
HEALTH_CONTEXT / FINANCE_CONTEXT / OTHER
```

The three sensitive types — **HEALTH_CONTEXT, FINANCE_CONTEXT, RELATIONSHIP** — require the producer to pass `userConfirmed=true`. The controller only sets that flag when the request body has `source='USER_CONFIRMATION'` (i.e., the mobile UI made the user explicitly tap "Yes, remember this"). Any other source → `SENSITIVE_MEMORY_REQUIRES_CONFIRM` (403).

## 3. Sources

```
CHAT / VOICE_NOTE / EMAIL / MANUAL_CHECKIN / USER_CONFIRMATION
```

The source is recorded for traceability AND to drive consent gating: even with `aiMemoryEnabled=true`, AI cannot persist a memory derived from email if `MemoryConsent.allowEmailForAI=false`, etc. (Today the gate lives in the producer call site; the v1.3 producer extraction will move it into the service for stricter enforcement.)

## 4. Lifecycle

- **Create** — explicit `POST /api/ai-memory` with the type + content + source.
- **View** — `GET /api/ai-memory` lists every row, ordered active-first then most-recent.
- **Edit** — `PATCH /api/ai-memory/:id` with `content` and/or `isActive`.
- **Delete one** — `DELETE /api/ai-memory/:id` hard-deletes a single row.
- **Clear all** — `POST /api/ai-memory/clear` flips `isActive=false` on every row (soft clear, audit-preserving).

## 5. Consent layer (`MemoryConsent`)

| Field | Default | Purpose |
|-------|---------|---------|
| `allowMemory` | true | Master. When OFF, no new memories are created from any source. |
| `allowEmailForAI` | false | Lets AI seed memory from email triage signals. Body never used. |
| `allowCommunicationContextForAI` | false | Lets AI use follow-up + reminder counts as memory inputs. |
| `allowVoiceNotesForAI` | false | Lets AI use voice-note transcripts as a memory source (voice flow lands in v1.3). |

The 3 source-specific toggles are OFF by default. They expand WHERE memory can come from; they do not bypass `allowMemory` (master) or `aiMemoryEnabled` (in CommunicationSetting). The screen surfaces all 4 in a "Memory consent" card above the memory list.

## 6. UX contract

- Sensitive types are **never** auto-suggested by AI without an explicit "Yes, remember this?" prompt in chat.
- The list view shows the type badge + the content + Inactive marker if soft-cleared.
- Clear-all uses a confirm dialog and reports count cleared via the API response.
- Inactive rows are NOT shown in v1.2 by default — they're filtered out at the controller's response stage; toggle "Show old" lands in v1.3.

## 7. Tests

`apps/api/src/modules/communication/companion-memory.service.spec.ts` covers:

- create refuses when `aiMemoryEnabled=false`
- sensitive types refuse without `userConfirmed=true`
- sensitive types accept with `userConfirmed=true`
- IDOR refusal on update + delete
- NotFound on unknown id
- clearAll soft-clears + reports count + preserves rows for audit

## 8. Manual test plan

1. Settings → Communication → toggle `aiMemoryEnabled=false` → POST `/api/ai-memory` → expect 403 AI_MEMORY_DISABLED.
2. Toggle ON → POST `/api/ai-memory` with `memoryType='PREFERENCE'` → 201.
3. POST with `memoryType='HEALTH_CONTEXT'` and `source='CHAT'` → 403 SENSITIVE_MEMORY_REQUIRES_CONFIRM.
4. POST with same payload but `source='USER_CONFIRMATION'` → 201.
5. Memory screen → Clear all → confirm → list empty + count toast.
6. Sign in as different user → memory list is empty for that user (no cross-user leakage).
