# Quick Capture — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/voice-companion/quick-capture.service.ts`, `apps/mobile/src/screens/voice/{QuickCaptureScreen,SuggestedActionsReviewScreen}.tsx`.

## 1. The user model

A single short utterance — typed or spoken — becomes 0-5 SuggestedAction proposals the user reviews + confirms one-by-one. Nothing is mutated until they tap Confirm.

Examples (vi):
- "Tôi vừa ăn cơm gà 45 nghìn" → `ADD_MEAL_LOG` + (optional) `ADD_EXPENSE`
- "Tôi hơi mệt, tối nay sắp lịch nhẹ thôi" → `ADD_MOOD_LOG` + `RESCHEDULE_TODAY`
- "Nhắc tôi trả lời email của khách lúc 8 giờ" → `CREATE_REMINDER`
- "Tôi ngủ lúc 1 giờ và dậy lúc 7 giờ" → `ADD_SLEEP_LOG`
- "Tôi thường làm việc tốt nhất buổi tối" → `SAVE_MEMORY` (PREFERENCE)

## 2. Backend contract

`POST /api/ai/parse-quick-capture`

Request:
```json
{ "transcript": "Tôi vừa ăn phở 50k", "source": "TEXT_FALLBACK", "locale": "vi" }
```

Response:
```json
{
  "voiceCaptureId": "vc-123",
  "followupQuestion": null,
  "actions": [
    {
      "id": "sa-456",
      "type": "ADD_MEAL_LOG",
      "title": "Phở",
      "locale": "vi",
      "confidence": 0.85,
      "payload": { "mealType": "LUNCH", "title": "Phở", "estimatedCost": 50000 },
      "status": "PENDING",
      "expiresAt": "2026-04-26T03:00:00.000Z"
    }
  ],
  "usedFallback": false
}
```

## 3. Confirm path

`POST /api/suggested-actions/:id/confirm` — controller dispatches to the existing module service per type:

| Action type | Downstream service | Resulting row |
|-------------|-------------------|---------------|
| `ADD_MEAL_LOG` | `MealLogsService.create` | `meal_log` |
| `ADD_SLEEP_LOG` | `SleepLogsService.create` | `sleep_log` |
| `ADD_MOOD_LOG` | `MoodLogsService.create` | `mood_log` |
| `ADD_EXPENSE` | `ExpensesService.create` | `expense` |
| `SAVE_MEMORY` | `CompanionMemoryService.create` (`USER_CONFIRMATION` source) | `ai_companion_memory` |
| `ADD_TASK / ADD_INCOME / CREATE_REMINDER / GENERATE_SCHEDULE / RESCHEDULE_TODAY` | Recognised but routed via the matching dedicated screen pre-filled (v1.3 wires server-side handlers). |
| `ASK_FOLLOWUP` | No row created — the user's confirm just dismisses the prompt. |

The `appliedRefId` + `appliedRefKind` columns on `SuggestedAction` pin the confirmed row's id for traceability.

## 4. Privacy + safety rules

- The AI only sees the user's own typed/spoken transcript — never adjacent rows from other users.
- The transcript is wrapped inside `<user-utterance>` and instructed to be DATA only (close-tag injection is also defused by `AiPromptTemplateService.sanitize`).
- The system prompt forbids medical / legal / high-risk financial advice and requires JSON-only output.
- Validated by `AiJsonValidationService` against `PARSED_RESULT_SCHEMA`.
- Falls back deterministically with a localised `followupQuestion` when the AI fails — no silent failure.

## 5. Tests

`apps/api/src/modules/voice-companion/quick-capture.service.spec.ts` covers:

- Valid JSON → PENDING actions persisted.
- Low confidence → followupQuestion always surfaced (even when AI returned null).
- Invalid JSON → `usedFallback: true` + safe fallback message.
- Cross-user reject refused.

## 6. Manual test plan

1. Settings → Voice companion → Quick capture → type "Tôi vừa ăn phở 50k" → Parse → modal opens with at least one ADD_MEAL_LOG suggestion.
2. Tap Confirm → next call to `GET /api/meal-logs?...` shows the new row.
3. Reject → row goes to REJECTED, no downstream entity created.
4. Wait 24h (or set `expiresAt` to past) → next `GET /suggested-actions/pending` returns no rows; the old row is now EXPIRED.
