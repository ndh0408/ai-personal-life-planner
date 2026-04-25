# Permissions — LifeOS AI

**Companion to [PRIVACY_CENTER.md](./PRIVACY_CENTER.md).**
This file is the per-permission reference: what we ask, what we use it for,
when we ask, what data flows where, and what data does NOT.

---

## At a glance

| Permission | Wired today | Privacy toggle that gates it | Sent to AI when on? | Background use? |
|------------|-------------|-------------------------------|---------------------|------------------|
| Notifications | ✅ `expo-notifications` | n/a (notification preferences live in `notification_settings`) | No | OS schedules locally; no background recording. |
| Calendar | ❌ Documented only | `useCalendarContext` | Only chosen events — never the full calendar. | No. |
| Health / Fitness | ❌ Documented only | `useHealthFitnessContext` | Only summary stats (avg sleep, step count) — never raw heart rate, GPS, etc. | No. |
| Location (foreground) | ❌ Documented only | `useLocationContext` | Coarse-grained context only (e.g. travel-time estimate). | **No background ever.** |
| Microphone | ❌ Documented only | `voiceInputEnabled` | Only the resulting transcript when the user explicitly hits Send. | **No.** Mic activates only while a record button is held. |
| Camera | ❌ Documented only | (per-feature pre-prompt) | Only when the user submits the captured frame (avatar / receipt scan). | No. |
| Photos | ❌ Documented only | (per-feature pre-prompt) | Only the picked image. | No. |

"Wired today" = an Expo module is installed AND a code path actually
requests / uses the permission. Items marked ❌ are documented in this file
and the Permission Center UI so users know what to expect; the matching code
ships in v1.2 according to `PRIVACY_CENTER.md` §9.

---

## 1. Notifications (✅ wired)

**Purpose.** Reminders for tasks, schedule items, sleep, meal, budget alerts, goal milestones, and assistant nudges (rule-based, no AI cost).

**When asked.** Only when:
1. The user taps **Enable push notifications** in `SettingsScreen → Notifications` — `requestPushPermission()` runs `Notifications.requestPermissionsAsync()`.
2. (Optional) During onboarding if the product team enables a one-screen prompt later. Today there is no onboarding-time prompt.

**Recovery on denial.** `SettingsScreen.handleEnablePush` shows a localised "Permission denied" alert with an **Open Settings** button that deep-links to `app-settings:` (iOS) or `Linking.openSettings()` (Android).

**Data flow.** Notification *settings* and *device push tokens* live in `notification_settings` and `notification_devices`. The notification dispatcher worker is on the v1.1 roadmap (see `ENTERPRISE_SCALE_SECURITY_AUDIT.md` §11) — until it ships, `notification_logs` rows are written PENDING but no push actually fires.

**iOS Info.plist.** `NSUserNotificationsUsageDescription` is set in `apps/mobile/app.config.ts` (note: `UNUserNotificationCenter` infers permission, but a description string is a friendly nicety).

**Android.** `POST_NOTIFICATIONS` is declared in `android.permissions` in `app.config.ts`.

---

## 2. Calendar (📋 documented)

**Purpose.** Read events the user explicitly picks so the AI scheduler can avoid clashes.

**When asked.** Only when the user:
1. Toggles `useCalendarContext` ON in PrivacySettings, AND
2. Opens the (future) "Pick events" screen and taps an event.

**Hard rules.**
- We do NOT bulk-read the whole calendar.
- We do NOT subscribe to event updates.
- We do NOT read calendar attendees, organiser, or event description without an explicit per-field opt-in.

**Data sent to AI.** Just the title + start/end of events the user picked, scoped to the relevant day(s).

**iOS Info.plist (when wired).** `NSCalendarsUsageDescription` — copy will mirror the `permissions.items.calendar.purpose` string in `vi.json` / `en.json`.

**Android (when wired).** `READ_CALENDAR` only. NEVER `WRITE_CALENDAR`.

**Code wiring path (v1.2):**
```ts
import * as Calendar from 'expo-calendar';
const { status } = await Calendar.requestCalendarPermissionsAsync();
```

---

## 3. Health / Fitness (📋 documented)

**Purpose.** Read sleep, steps, and activity totals if the OS exposes them, to enrich the daily review and weekly insight with real data instead of self-reported logs.

**When asked.** Only when:
1. `useHealthFitnessContext` toggle is ON, AND
2. The user opens a screen that needs it (Health module, future).

**Hard rules.**
- This app does NOT diagnose, treat, or prescribe. The AI's `screenForUnsafeContent` (now bilingual vi+en) catches medical-keyword leaks and replaces them with a "consult a qualified professional" template.
- We read SUMMARY data only (e.g. sleep duration, daily step count). We do NOT read raw heart-rate streams, ECG, blood pressure, or workout GPS tracks.
- Categories the user must opt into per-platform (iOS HealthKit, Android Health Connect) are listed individually so the user picks granularly.

**Data sent to AI.** Summary fields only — never timestamps with second-level precision, never per-event heart-rate samples.

**iOS (when wired).** `NSHealthShareUsageDescription` AND a per-category picker (HealthKit's standard flow).

**Android (when wired).** Health Connect intents — Android Health Connect handles the per-category opt-in surface natively.

---

## 4. Location, foreground only (📋 documented)

**Purpose.** Estimate travel time / context when the app is in the foreground (e.g. "you have a 17-minute drive at 14:00"). MVP only.

**When asked.** Only when:
1. `useLocationContext` toggle is ON, AND
2. The user opens a screen that needs it (e.g. Today planner with travel-time estimate, future).

**Hard rules.**
- Foreground only. The code never calls `requestBackgroundPermissionsAsync()`. There is no `locationProvider.startLocationUpdatesAsync(...)` background task.
- We do NOT store a location history. The single coarse fix is consumed in-memory and discarded.
- We do NOT geofence.

**iOS (when wired).** `NSLocationWhenInUseUsageDescription` — explicitly NOT `NSLocationAlwaysUsageDescription`.

**Android (when wired).** `ACCESS_COARSE_LOCATION` (NOT `_FINE_` unless the feature evolves) and NEVER `ACCESS_BACKGROUND_LOCATION`.

**Code wiring path (v1.2):**
```ts
import * as Location from 'expo-location';
const { status } = await Location.requestForegroundPermissionsAsync();
```

---

## 5. Microphone (📋 documented)

**Purpose.** Voice notes and (future) voice assistant input.

**When asked.** Only when:
1. `voiceInputEnabled` toggle is ON, AND
2. The user explicitly taps a record button.

**Hard rules — non-negotiable.**
- The mic activates ONLY while the user is holding a record button.
- The recording UI shows a clear, persistent "Recording…" indicator while the mic is hot.
- A clearly-labelled Stop button is always visible.
- We NEVER record in the background. There is no `expo-task-manager` audio task and there will not be one.
- We do NOT continuously listen for a wake word.
- We do NOT keep the recording buffer after the user has cancelled.
- We do NOT upload raw audio to a third-party transcription service without making it visible in the Privacy Center.

**iOS (when wired).** `NSMicrophoneUsageDescription`. Do NOT add `NSSpeechRecognitionUsageDescription` unless on-device speech recognition is wired.

**Android (when wired).** `RECORD_AUDIO` only. NEVER `MODIFY_AUDIO_SETTINGS`. NEVER background audio service.

---

## 6. Camera & Photos (📋 documented)

**Purpose.**
- Camera: avatar capture, scan a receipt to add an Expense.
- Photos: pick an avatar, pick a receipt photo from the library.

**When asked.** Only when the user taps the matching button (e.g. "Take photo", "Pick from library"). We do NOT pre-prompt at app launch.

**Hard rules.**
- We do NOT enumerate the user's photo library — `expo-image-picker` shows the OS picker; we receive only the picked file.
- We do NOT request `MediaLibrary` (write/full-album access).
- Receipt OCR happens server-side; the captured image is sent over HTTPS, parsed, and the parsed text is the only thing kept (image deleted after parsing) — when the OCR feature ships.

**iOS (when wired).** `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`. Photos request is the limited-library variant where supported.

**Android (when wired).** `CAMERA`. For photos, prefer the new `READ_MEDIA_IMAGES` (Android 13+) over the legacy `READ_EXTERNAL_STORAGE`.

---

## How to test on each platform

Follow this matrix when validating a build that has all permissions wired (post-v1.2). For v1.1 only the **Notifications** column is testable.

### iOS (Simulator + physical device)

1. Build with `eas build --platform ios --profile preview`.
2. Install on simulator / TestFlight device.
3. **Notifications:**
   - Settings → Notifications → tap **Enable push notifications** → expect OS prompt → grant → toast `notifications.enabled`. Deny → expect "Open Settings" CTA → tap → deep-links to **Settings → LifeOS AI → Notifications**.
4. **Calendar / Location / Microphone / Camera / Photos** (when wired): trigger the matching feature; expect the OS prompt with the localised `NS*UsageDescription` text. Settings → LifeOS AI → toggle each permission off → verify the matching feature degrades gracefully.
5. **Privacy toggles:** Settings → Privacy → flip each "Use X for AI" toggle off → call the matching `/api/ai/*` endpoint → confirm response contains `disabledByPrivacy: true`.
6. **Consent log:** every toggle should show in DataUsageSummary → Recent consent activity within ~1s.

### Android (emulator + physical device)

1. Build with `eas build --platform android --profile preview`.
2. Install via internal testing track / sideload.
3. **Notifications:** same flow as iOS; Android 13+ surfaces an explicit OS prompt.
4. **Calendar / Location / Microphone / Camera / Photos** (when wired): trigger the matching feature; expect the OS prompt with the `<uses-permission>` rationale dialog. Settings → Apps → LifeOS AI → Permissions → revoke → verify graceful degrade.
5. Same Privacy + consent flows as iOS.

### Edge cases worth verifying

- Deny notification permission → app does NOT crash, user can still use the app, the Settings entry shows "Permission denied" + Open Settings.
- Toggle off `useFinanceForAI` → `POST /api/ai/analyze-finance` returns the locale fallback with `disabledByPrivacy: true`. Toggle back on → next call returns a real analysis.
- Toggle off `personalizationEnabled` → `POST /api/ai/chat` still answers, but the system prompt does not include `mainGoal` / `activityLevel`.
- Sign out → privacy settings persist (per-user). Sign in as another user → see THAT user's settings, not the previous one's.
- Delete account (when wired) → `User onDelete: Cascade` removes `privacy_settings` + `user_consents` along with all other owned rows.

---

## Where to file changes

- Add a permission → update this file, `PRIVACY_CENTER.md`, both `vi.json` and `en.json` (`settings.privacy.permissions.items.<key>`), Permission Center UI, and PrivacyService gates.
- Change a description → bump `PRIVACY_POLICY_VERSION` in `apps/mobile/src/services/api/privacy.api.ts`. The next consent event will record the new version, so the audit trail shows the policy bump.
- Remove a permission → keep the row in `UserConsentType` enum (DB constraint) but mark it deprecated in this doc.
