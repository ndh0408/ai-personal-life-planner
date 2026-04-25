# App Store Privacy Readiness — LifeOS AI

**Audience:** the engineer + PM filling in App Store Connect privacy disclosures and Google Play Data Safety form.
**Companion to:** [PRIVACY_CENTER.md](./PRIVACY_CENTER.md), [PERMISSIONS.md](./PERMISSIONS.md), [AI_DATA_MINIMIZATION.md](./AI_DATA_MINIMIZATION.md), [EXPLAINABLE_RECOMMENDATIONS.md](./EXPLAINABLE_RECOMMENDATIONS.md).

## 1. One-line app summary for store reviewers

> "Personal life OS — daily planner, habits, meals, sleep / mood, finance, goals, AI assistant. All AI personalisation is gated by per-domain user toggles surfaced in Settings → Privacy & permissions. The mobile app does not run any background recording, location, or tracking."

## 2. Apple App Store — Privacy "Nutrition Label"

For the App Store Connect "App Privacy" section, declare the following.

### Data Linked to User (collected and tied to identity)

| Data type | Used for | Linked? | Tracking? |
|-----------|----------|---------|-----------|
| Email address | Account creation, login | YES | NO |
| Name (display) | Personalisation in-app | YES | NO |
| Health & Fitness — sleep duration, mood, energy | App functionality (daily review, nudges) | YES | NO |
| Financial info — income, expenses, budgets, debts | App functionality (finance analysis, dashboard) | YES | NO |
| Other usage data — task counts, habit logs, schedule items | App functionality | YES | NO |
| User content — chat messages, profile fields | App functionality (AI chat, personalisation) | YES | NO |
| Identifiers — User ID | App functionality | YES | NO |
| Crash data | App functionality | YES (only if `anonymizedDiagnostics=true`) | NO |
| Performance data | App functionality | YES (only if `anonymizedDiagnostics=true`) | NO |

### Data Not Collected

- Contacts
- Photos / Videos (no MediaLibrary scan; user-picked images via `expo-image-picker` are NOT enumerated)
- Audio / Voice recordings — voice notes when shipped are user-initiated only, never the background mic
- Location — until the user toggles `useLocationContext` ON, no permission is requested. Even then: foreground only, never background.
- Search history outside the app
- Browsing history outside the app
- Sensitive info (race, religion, sexual orientation, political views, biometrics)

### Data Used to Track You

**None.** No third-party SDKs, no advertising IDs, no cross-app or cross-website tracking. Verified by `package.json` review (no Segment / Amplitude / Mixpanel / Adjust / AppsFlyer / Branch).

## 3. Google Play — Data Safety form

The same shape applies. Highlights:

- **Data collected:** identifiers, financial info, health & fitness, app activity, app info & performance.
- **Data shared with third parties:** none. (BYOK: users can configure their own AI provider; that is the user's account, not data sharing on our part. Disclose in the per-data-type "Why?" field.)
- **Encryption in transit:** YES (HTTPS-only enforced at build for production — see `app.config.ts` resolver).
- **Encryption at rest:** Postgres handles its own encryption-at-rest at the volume layer; BYOK API keys are additionally AES-256-GCM-encrypted by `EncryptionService`.
- **Data deletion:** YES — `Settings → Privacy & permissions → Delete account`. See PRIVACY_CENTER.md §5.
- **Independent security review:** YES — see `SECURITY_AUDIT_REPORT.md` and `ENTERPRISE_SCALE_SECURITY_AUDIT.md`.

## 4. Required iOS Info.plist usage strings

Today only `NSUserNotificationsUsageDescription` is set. When v1.3 wires the remaining permissions, add:

| Key | When wired | Suggested copy (en) |
|-----|------------|---------------------|
| `NSCalendarsUsageDescription` | Calendar Integration | "LifeOS AI reads only the events you pick to avoid scheduling clashes." |
| `NSLocationWhenInUseUsageDescription` | Foreground Location | "LifeOS AI uses your location while the app is open to estimate travel time." |
| `NSCameraUsageDescription` | Avatar / receipt scan | "LifeOS AI uses the camera only when you tap a feature that needs it." |
| `NSPhotoLibraryUsageDescription` | Avatar picker | "LifeOS AI lets you pick a photo as your avatar — only the picked photo is read." |
| `NSMicrophoneUsageDescription` | Voice notes | "LifeOS AI records audio only while you hold the record button. We never record in the background." |
| `NSHealthShareUsageDescription` | Health/Fitness Integration | "LifeOS AI reads sleep, steps, and activity totals you authorise so it can give better lifestyle advice. Lifestyle only — never a diagnosis." |
| `NSHealthUpdateUsageDescription` | (only if writing back) | not requested today |

Do NOT add `NSLocationAlwaysUsageDescription` — background location is not used.

## 5. Required Android `<uses-permission>` declarations

| Permission | When wired | Notes |
|------------|------------|-------|
| `POST_NOTIFICATIONS` | already declared | Android 13+ runtime prompt. |
| `RECEIVE_BOOT_COMPLETED` | already declared | Reschedules local reminders after device reboot. |
| `VIBRATE` | already declared | Notification vibration. |
| `READ_CALENDAR` | Calendar Integration | NEVER `WRITE_CALENDAR`. |
| `ACCESS_COARSE_LOCATION` | Foreground Location | Prefer COARSE over FINE; never `ACCESS_BACKGROUND_LOCATION`. |
| `CAMERA` | Camera | — |
| `READ_MEDIA_IMAGES` | Photos | Android 13+ replacement for legacy `READ_EXTERNAL_STORAGE`. |
| `RECORD_AUDIO` | Voice notes | NEVER background audio service. |
| (Health Connect intents) | Health/Fitness Integration | Per-category, native Health Connect flow. |

## 6. Per-store review check

Before submitting either store binary:

- [ ] App icon / splash / metadata final (no `com.yourname.lifeosai` placeholder).
- [ ] Privacy policy URL hosted at a stable URL.
- [ ] Personalization Consent screen reviewed by legal in BOTH vi and en.
- [ ] Permission Center screen lists every permission the binary will ask for.
- [ ] App Review Notes link to `docs/PRIVACY_CENTER.md` so reviewers see the architecture.
- [ ] Demo account credentials provided in App Review Notes (a sandbox tenant — NEVER a production user).
- [ ] Verified that toggling `useFinanceForAI=false` in the demo account makes `POST /api/ai/analyze-finance` return `disabledByPrivacy: true`.
- [ ] Verified that the demo account's data is wiped between submissions.
- [ ] EU-aware copy: every privacy claim made in the consent screen is also in PRIVACY_CENTER.md and AI_DATA_MINIMIZATION.md so reviewers can independently verify.
- [ ] Confirmed `package.json` has no analytics / tracking deps.

## 7. Open compliance items

Tracked in `ENTERPRISE_SCALE_SECURITY_AUDIT.md` §17 + §18:

- Account deletion endpoint is shipped (v1.2 — `POST /api/privacy/delete-account-request` records intent + 30-day grace). The actual delete-cascade worker lands in v1.3.
- Data export is shipped (v1.2 — `POST /api/privacy/export-data` returns the JSON document inline). Async export job for very large users lands in v1.3.
- Field-level encryption for `monthlySalary`, `MoodLog.note`, `healthNotes` lands in v1.3.
- Differential-privacy aggregation for opt-in diagnostics lands in v1.4.
