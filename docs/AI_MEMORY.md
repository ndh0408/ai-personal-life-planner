# AI Memory — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/communication/companion-memory.service.ts`, `apps/mobile/src/screens/communication/AICompanionMemoryScreen.tsx`, schema `AICompanionMemory` + `MemoryConsent`.
**Cross-references:** [AI_COMPANION_MEMORY.md](./AI_COMPANION_MEMORY.md) (the original v1.2 doc with full type/source matrices), [VOICE_COMPANION.md](./VOICE_COMPANION.md), [QUICK_CAPTURE.md](./QUICK_CAPTURE.md).

## 1. The user-facing principle

When the user says something useful — "I work best in the evening", "I tend to skip breakfast", "I want to save more this month" — the AI may ASK:

> "Would you like me to remember this so I can give better suggestions?"

Only when the user taps "Yes" does the memory get persisted. The store is then fully transparent: every memory is viewable, editable, deletable, or wipeable in bulk via the AI Memory screen.

## 2. How a memory gets created

Two paths land memory rows:

### A. Quick-capture confirmation
Voice/text capture → AI proposes `SuggestedAction { type: 'SAVE_MEMORY', payload: { memoryType, content } }` → user confirms → controller routes to `CompanionMemoryService.create(userId, input, userConfirmed=true)` → row created.

The `userConfirmed=true` flag is REQUIRED for the three sensitive types (`HEALTH_CONTEXT`, `FINANCE_CONTEXT`, `RELATIONSHIP`). The controller only sets it when the request body's `source` is `USER_CONFIRMATION` — i.e. the action came from an explicit user-tap path.

### B. Direct API
`POST /api/ai-memory` with `{ memoryType, content, source }`. Same gates apply; same sensitive-type confirm requirement.

## 3. Sources

```
CHAT / VOICE_NOTE / EMAIL / MANUAL_CHECKIN / USER_CONFIRMATION
```

The source is recorded for traceability AND used to gate which memory creation paths the broader `MemoryConsent` allows:

- `allowMemory` — master switch. OFF → no new rows from any source.
- `allowEmailForAI` — gates EMAIL-sourced memories.
- `allowCommunicationContextForAI` — gates memory derived from follow-up + reminder counts.
- `allowVoiceNotesForAI` — gates VOICE_NOTE-sourced memories.

Privacy resolver applies these BEFORE the AI sees the matching context.

## 4. Lifecycle

| Operation | Endpoint | Effect |
|-----------|----------|--------|
| List | `GET /api/ai-memory` | active-first, recent-first; up to 200 rows |
| Create | `POST /api/ai-memory` | refused unless `aiMemoryEnabled` + (sensitive types) `userConfirmed=true` |
| Edit | `PATCH /api/ai-memory/:id` | content (≤600 chars) + isActive |
| Delete one | `DELETE /api/ai-memory/:id` | hard delete |
| Clear all | `POST /api/ai-memory/clear` | soft-clear: `isActive=false` on every active row, audit trail kept |

## 5. Why soft-clear?

When the user taps Clear-all we keep the rows in the DB with `isActive=false` so:
- The user can review what AI USED to know about them, even after clearing.
- A future "undo clear" UI is possible.
- An incident response can answer "what was AI working with on date X?".

Hard delete a single row is allowed via `DELETE /api/ai-memory/:id`; bulk wipe is intentionally soft-only.

## 6. UX contract

- Sensitive types are NEVER auto-suggested without an explicit "Yes, remember this?" prompt in chat.
- The list view shows a type Badge + content + Inactive marker if soft-cleared.
- Clear-all uses a confirm dialog and toasts the count cleared.
- Memory rows shown to AI as additional system-prompt context are tagged `<user-memory>...</user-memory>` so the model treats them as DATA, not instructions.

## 7. Manual test plan

1. Settings → Voice → AI memory → toggle `allowMemory` OFF → POST `/api/ai-memory` → 403 AI_MEMORY_DISABLED.
2. Toggle ON → POST `{memoryType:'PREFERENCE', content:'morning person', source:'CHAT'}` → 201.
3. POST `{memoryType:'HEALTH_CONTEXT', source:'CHAT'}` → 403 SENSITIVE_MEMORY_REQUIRES_CONFIRM.
4. Same payload with `source:'USER_CONFIRMATION'` → 201.
5. Clear all → confirm → list empty in UI; row count in DB unchanged but all `isActive=false`.
