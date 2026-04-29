# Health permissions setup (round 36)

This file documents the per-platform configuration the sensor sync needs
beyond the JS code in `apps/mobile/src/services/device/`.

## Android — Health Connect

The package is `react-native-health-connect`. It autolinks; nothing is
required in `app/build.gradle` beyond the existing autolink path.

`AndroidManifest.xml` already declares:
- `android.permission.health.READ_SLEEP`
- `android.permission.health.READ_HEART_RATE`
- `android.permission.health.READ_STEPS`
- a `<queries>` entry for the Health Connect package (Android 11+ scoped
  package visibility)
- two intent filters on MainActivity:
  - `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` for the
    Health Connect permission dialog's "Privacy policy" link
  - `android.intent.category.HEALTH_PERMISSIONS` on the legacy
    permission-usage activity alias (Android 13-)

When the app first calls `healthConnect.ensureReady()` the Health Connect
APK shows its standard system dialog requesting the three reads. If the
user denies, we never persist a sample; the inference fallback runs
instead.

The first time the app launches on a device that has never used Health
Connect, the OS will prompt the user to install or enable the
`com.google.android.apps.healthdata` APK — that's a system flow we
don't intercept.

## iOS — HealthKit

The package is `react-native-health` (Apple HealthKit). It autolinks via
CocoaPods; no manual native registration needed once
`pod install` runs.

You must add the following keys to `Info.plist` so Apple's privacy
review accepts the build:

```xml
<key>NSHealthShareUsageDescription</key>
<string>LifeOS reads your sleep, heart rate, and step samples so the assistant can offer better suggestions and the daily plan can adapt to how rested you are. We never share this data; you can revoke access in iOS Settings → Privacy → Health.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>LifeOS does not currently write to HealthKit. This permission is unused.</string>
```

The Xcode project also needs the **HealthKit** capability enabled
(Signing & Capabilities → + Capability → HealthKit). The first time the
app calls `healthKit.ensureReady()` the system prompts the user with the
standard HealthKit per-data-type permission sheet.

There is no equivalent of Health Connect's privacy-policy intent on iOS
— Apple shows a single system dialog and links to Settings → Privacy →
Health for ongoing management. The app's in-app `Privacy` screen still
controls whether health rows enter the AI snapshot
(`useHealthForAI` flag, R20).

## Capacitor / managed runtime users

LifeOS is bare React Native, not Expo Go. If a fork were ever to run
under Expo Go, `react-native-health` and `react-native-health-connect`
both require a custom dev client / bare workflow — Expo Go's runtime
can't load them.
