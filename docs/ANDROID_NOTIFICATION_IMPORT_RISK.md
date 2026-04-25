# Android Notification Import — Risk Treatment

**Status:** **NOT IMPLEMENTED in v1.2.** Toggle exists in `CommunicationSetting.androidNotificationImportEnabled` to reserve the contract; the actual `NotificationListenerService` integration is gated behind this risk doc.

This document exists so the engineer who eventually wires `expo-notification-listener` (or equivalent) does it the right way.

## 1. Why this is dangerous

Android's `NotificationListenerService` is one of the most powerful permissions on the platform. Once granted, an app can:

- Read the title + body of EVERY notification posted by EVERY other app
- See app-package names, post timestamps, action buttons
- Snoop on banking OTPs, 2FA codes, password-reset emails, private DMs, calendar invites, fitness data, location-share notifications, and more

This is exactly the kind of permission Apple has refused to expose on iOS — and exactly the kind of permission that gets apps removed from the Play Store when used carelessly.

## 2. Hard rules for any future implementation

If/when this lands, every one of these rules is non-negotiable:

1. **OFF by default.** `CommunicationSetting.androidNotificationImportEnabled` defaults `false` and the user must explicitly toggle it AND grant the OS-level `Notification access` setting (which Android shows as a separate system page).
2. **Explainer screen.** Before the OS toggle, mobile MUST show a dedicated screen with:
   - "This will let LifeOS read notifications from every app on your phone."
   - "We use this to suggest message reminders only. We do not store the notification body."
   - "Banking, OTP, 2FA, and password notifications are blocked at the source."
   - "You can turn this off any time."
3. **Denylist.** Hard-coded package + category denylist enforced LOCAL on the device, before anything is uploaded:
   - Categories: `msg_otp`, `msg_authentication`, `msg_2fa`, banking-style notifications.
   - Package patterns: any app with `bank`, `vietcombank`, `mbbank`, `techcombank`, `acb`, `tpbank`, `vpbank`, `bidv`, `agribank`, `payment`, `wallet`, `wallet`, `momo`, `zalopay`, `viettel`, `vnpay` in the package id.
   - Banking apps' OTP categories explicitly skipped even if the package isn't denylisted.
4. **No raw upload.** Notifications are processed locally. Only the user-confirmed `MessageReminder.title + contactName + platform` is sent to the backend.
5. **No long-term raw storage.** Even local storage of raw notifications is capped at 24h and stays in encrypted on-device storage.
6. **No analytics.** No counts, no histograms, no telemetry are emitted from this surface.
7. **No accessibility services.** Do NOT enable `AccessibilityService` to "improve" notification reading. It is forbidden.
8. **One-tap revoke.** The Communication Settings screen provides a single toggle that, when turned off, immediately:
   - Disables the listener service
   - Wipes the local 24h cache
   - Sets `androidNotificationImportEnabled=false` server-side
9. **Quarterly re-consent.** If user has the toggle ON for >90 days, mobile re-prompts them to confirm they still want it.
10. **Play Store disclosure.** Data Safety form must list "Notifications from other apps" as data accessed and "App functionality" as the only purpose.

## 3. iOS deliberately not supported

iOS does not expose third-party app notifications to other apps. We will **not** ship any workaround (no clipboard polling, no screenshot-OCR, no Accessibility-style hacks). The Message Reminder surface on iOS is manual-only. This is by Apple-platform design and we honor it.

## 4. Decision

For v1.2 we ship the toggle (so the consent ledger captures user intent today) but the listener service is not wired. v1.3 should NOT add it without re-reviewing this document and getting explicit product + legal sign-off.

If the team decides the risk is not justified by the product value, the toggle should be removed in v1.3 to prevent dead-UI confusion — preferable to shipping a partial implementation.
