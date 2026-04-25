# Health & Fitness Integration — LifeOS AI

**Source of truth in code:** `apps/api/src/modules/voice-companion/health-integration.service.ts`, `apps/mobile/src/screens/voice/HealthIntegrationSettingsScreen.tsx`, schema `HealthIntegrationSetting`.

## 1. v1.2 status

The data model + API + mobile screen + per-data-type toggles are shipped. Native HealthKit / Health Connect adapters are **not** wired in v1.2 — the toggles capture user intent today; the actual reads land in v1.3 with the matching native modules.

The DTO surfaces `nativeAvailable: false` so mobile can render a clear "not yet wired in this build" notice.

## 2. Provider matrix

| Provider | Platform | Module (v1.3) |
|----------|----------|---------------|
| `HEALTHKIT` | iOS | `expo-health` or `react-native-health` (RN bridge) |
| `HEALTH_CONNECT` | Android | `expo-health-connect` (when published) or a thin native bridge |
| `NONE` | both | default; no integration |

## 3. Per-data-type opt-in

User flips one of these in the screen — each maps to a HealthKit / Health Connect READ permission when the native module activates:

| Toggle | What it reads | Sent to AI as |
|--------|---------------|----------------|
| `readSleep` | Sleep duration + asleep/in-bed segments | `sleepStats.avgMinutes`, `sleepStats.goodNights` |
| `readSteps` | Daily step count | aggregated daily total only |
| `readExercise` | Exercise minutes | aggregated daily total only |
| `readHeartRate` | Resting + workout averages | OFF by default. Aggregated only — never raw samples |
| `readWeight` | Weight if user logs it | latest value only |

## 4. Hard rules (architectural — not just policy)

- We do NOT send raw timestamped samples to AI. Aggregates only.
- We do NOT request a permission unless the matching toggle is ON.
- We do NOT enable `HEALTHKIT` or `HEALTH_CONNECT` without a per-platform native module published — until then, the provider chip is locked to `NONE` at runtime if the native bridge isn't present (`nativeAvailable: false`).
- We do NOT diagnose. The AI's `screenForUnsafeContent` (bilingual vi+en) catches medical-keyword leaks.

## 5. Integration with privacy gates

`PrivacySetting.useHealthFitnessContext` (the broader privacy toggle) gates whether ANY health/fitness data flows into AI prompts. When OFF, the per-type toggles in this screen don't matter — the privacy resolver short-circuits in `AiProviderResolverService.completeForUser`.

## 6. Manual test plan (v1.2)

1. Settings → Voice companion → Health & fitness → choose `HEALTHKIT` chip → row updates.
2. Toggle `readSleep` ON → row updates.
3. (v1.3 once wired) on iOS expect HealthKit prompt for sleep category only.

## 7. Rollout note

Until v1.3 wires the native side, the screen is honest: the warning card says "Native integration ships in v1.3. The toggles below capture your intent today." This way the consent ledger captures user intent now and v1.3 just plugs in the native fetch path.
