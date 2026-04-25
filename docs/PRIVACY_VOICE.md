# Privacy — Voice & Smart Check-ins

**Audience:** legal, security review, store reviewers, the user reading the app's privacy disclosures.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [APP_STORE_PRIVACY_READINESS.md](./APP_STORE_PRIVACY_READINESS.md), [VOICE_COMPANION.md](./VOICE_COMPANION.md), [SMART_CHECKINS.md](./SMART_CHECKINS.md), [HEALTH_INTEGRATION.md](./HEALTH_INTEGRATION.md), [AI_MEMORY.md](./AI_MEMORY.md), [QUICK_CAPTURE.md](./QUICK_CAPTURE.md).

## 1. Plain-language summary

LifeOS AI's voice + check-in features only listen / observe when the user explicitly initiates each interaction. The app does NOT keep a hotword open in the background. The app does NOT poll the OS for sensor data outside of explicit user-toggled integrations. Health & fitness data, when ever wired, is read in aggregate only and never as raw timestamped samples.

## 2. The hard "no" list

- ❌ No background hotword. No "Hey LifeOS" always-listening mode.
- ❌ No background microphone. The mic activates only while the user holds a record button OR taps a foreground voice button.
- ❌ No background location, no continuous heart-rate streaming, no raw sensor sampling.
- ❌ No silent notification "data harvesting".
- ❌ No reading other apps' notifications without the explicit Android Notification Listener opt-in (still gated behind ANDROID_NOTIFICATION_IMPORT_RISK.md and OFF in v1.2).
- ❌ No accessibility-service screen scraping.
- ❌ No auto-applying suggested actions — every voice/text capture must be confirmed by the user before it touches data.

## 3. Per-feature data contract

| Feature | What we capture | When | Stored? | Sent to AI? | User control |
|---------|-----------------|------|---------|-------------|--------------|
| Push-to-talk voice | Audio while button held | User-initiated | NO — discarded after STT | Transcript only | Stop button + permission revocation in OS settings |
| Quick text capture | Text the user typed | User-initiated | YES (`VoiceCapture.transcript`) | YES, wrapped as `<user-utterance>` | Full CRUD on the row, deleted with account |
| Suggested actions | AI's structured proposals | After parse | YES (`SuggestedAction`, status PENDING) | NO (already AI-derived) | Confirm / Reject / 24h auto-EXPIRE |
| Smart check-in notifications | None — these are outbound only | Per `SmartCheckinSetting` schedule | n/a | n/a | Toggle each type independently |
| Smart check-in answers | The user's tap on the notification → quick-log screen | User responds | YES (in matching log table) | Per privacy gates (sleep / mood / meal) | Toggle each in PrivacySettings |
| Health/fitness reads (v1.3) | Aggregated daily totals only | When user toggles + grants OS permission | YES (aggregates, no raw samples) | YES, summarised | Per-data-type toggle + provider chip + OS-level permission |
| AI Companion memory | Free-form text the user confirmed | After explicit user-confirm | YES (`AICompanionMemory`) | YES, as `<user-memory>` block | View / edit / delete / clear-all |

## 4. Encryption

- Audio is never persisted server-side.
- `VoiceCapture.transcript` and `SuggestedAction.payload` are stored as-is in Postgres (rely on volume-level encryption-at-rest in production).
- BYOK keys + OAuth tokens (separate features) get AES-256-GCM via `EncryptionService`.
- Field-level encryption for AI memory content lands in v1.4 via `pgcrypto`.

## 5. Logging policy

`SpeechToTextService` logs ONLY:
- `provider`, `mime`, `bytes` (size only — not the audio)

`QuickCaptureService` logs ONLY:
- AI provider info, brief error class on fallback (via `briefAiError`)

It NEVER logs:
- Audio bytes
- Transcript content
- Confirmed payload values
- AI memory content

## 6. Disconnect / delete

| Action | Effect |
|--------|--------|
| Toggle smart-checkin OFF | Server stops scheduling that type |
| Toggle health-fitness OFF | Native module stops requesting the matching OS permission |
| Clear AI memory | All `AICompanionMemory.isActive=false` (audit-preserving soft clear) |
| Disconnect Gmail/Outlook | Tokens revoked + cached emails wiped (separate flow) |
| Delete account | 30-day grace then cascade delete: every `voice_captures`, `suggested_actions`, `smart_checkin_settings`, `health_integration_settings`, `ai_companion_memories` row tied to user is removed (FK `onDelete: Cascade`) |

## 7. App-store disclosures

When the v1.3 native modules ship, add to:

**Apple App Privacy:**
- Audio Data → User content → App functionality (when STT wires)
- Health & Fitness → User content → App functionality (when HealthKit wires)

**Google Play Data Safety:**
- Audio → Voice or sound recordings (when STT wires) — note: ephemeral, not persisted
- Health & fitness → per-category as user grants

Required Info.plist strings: `NSMicrophoneUsageDescription`, `NSHealthShareUsageDescription` (already documented in `APP_STORE_PRIVACY_READINESS.md`).
