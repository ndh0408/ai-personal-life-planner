# Voice Companion — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/voice-companion/*`, `apps/mobile/src/screens/voice/*`, schema Section N.
**Companion to:** [QUICK_CAPTURE.md](./QUICK_CAPTURE.md), [SMART_CHECKINS.md](./SMART_CHECKINS.md), [HEALTH_INTEGRATION.md](./HEALTH_INTEGRATION.md), [AI_MEMORY.md](./AI_MEMORY.md), [PRIVACY_VOICE.md](./PRIVACY_VOICE.md).

## 1. Why no background hotword

We do not, and will not, ship a "Hey LifeOS" always-listening hotword. Reasons:

- iOS does not allow third-party apps to keep the mic open in the background. Apple-platform constraint.
- Android allows it via foreground services + persistent notification, but the privacy + battery cost is enormous and most users do not want a 24/7 mic.
- The product value is lower than the trust cost. The user can already say "Quick capture" via three lighter-weight surfaces (push-to-talk, OS shortcut, text fallback).

## 2. Three voice surfaces shipped

### A. Push-to-talk (in-app)
- User taps + holds the mic button on `QuickCaptureScreen` or `VoiceCompanionScreen`.
- App requests `expo-av` permission lazily on first press.
- "Recording…" indicator + Stop button visible the whole time.
- On release: audio → STT → text → AI parse → `SuggestedAction` rows.
- v1.2 ships the screen + the parse pipeline; STT itself is a stub returning `notImplemented: true`. v1.3 wires the STT provider.

### B. Quick voice / text note
- Same `QuickCaptureScreen` accepts text fallback.
- Same parse path → same `SuggestedAction` review modal.

### C. OS shortcuts (planned, v1.3)
- iOS Siri Shortcuts: `add_task`, `add_expense`, `meal_log`, `mood_checkin`, `sleep_log`, `ask_ai`.
- Android App Shortcuts + intents for the same set.
- These are NOT the system mic — they trigger the matching Quick-Log screen pre-filled.

## 3. The contract

Every voice/text capture goes through this state machine:

```
transcript ──► /ai/parse-quick-capture ──► SuggestedAction[].PENDING
                                                      │
                                User reviews in SuggestedActionsReviewModal
                                                      │
                            ┌─────────────────────────┴─────────────────────────┐
                            ▼                                                   ▼
              /suggested-actions/:id/confirm                     /suggested-actions/:id/reject
                            │                                                   │
                  service creates the matching                                 row → REJECTED
                  downstream entity, sets                                      no data mutated
                  status=CONFIRMED + appliedRefId
```

Rules enforced in code:
- Suggested actions NEVER auto-apply. They expire after 24h (`expiresAt`) → `EXPIRED`.
- Low-confidence (< 0.5) parse triggers a `followupQuestion` even if the AI didn't supply one.
- The downstream services (MealLogs / SleepLogs / MoodLogs / Expenses / CompanionMemory) are reused — no duplicate write paths.

## 4. Files added

Backend: `voice-companion.module.ts`, `voice-companion.controller.ts`, `quick-capture.service.ts` (+ spec), `smart-checkin-settings.service.ts`, `health-integration.service.ts`, `speech-to-text.service.ts`, `dto.ts`, migration `20260425025731_add_voice_companion`.

Mobile: 7 screens under `apps/mobile/src/screens/voice/`, `services/api/voice-companion.api.ts`, nav routes, settings entry, 1267 i18n keys (vi + en parity).
