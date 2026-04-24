# Health / Lifestyle module

Three screens wire the user's wellbeing data end-to-end: a read-heavy HealthScreen that summarizes the last 7 days, a SleepMoodCheckin modal for the most frequently-logged entries, and a HealthMetricScreen for numeric measurements.

All three share a non-medical-advice guardrail: the copy is lifestyle-oriented, the AI insight is template-based (no live AI call), and every screen surfaces a disclaimer that these numbers are not a substitute for a doctor.

## Screens

### HealthScreen

Location: `apps/mobile/src/screens/health/HealthScreen.tsx`.

Read-only aggregator. Three parallel queries (7-day windows):

- `GET /api/sleep-logs?from=&to=` — `['sleep-logs', from, to]`
- `GET /api/mood-logs?from=&to=` — `['mood-logs', from, to]`
- `GET /api/health-metrics?from=&to=` — `['health-metrics', from, to]`

Sections rendered top-to-bottom:

1. **Quick actions** — two buttons: "Sleep & mood check-in" (`SleepMoodCheckin`) and "Log metrics" (`HealthMetric`).
2. **Sleep summary** — latest `SleepLog` card with slept/woke/duration, quality badge (color-coded) and date badge. Below: 7-day average hours + trend glyph (UP/FLAT/DOWN/UNKNOWN) via `<InsightCard/>`.
3. **Mood / energy summary** — today's `MoodLog` card with mood, energy, stress, and note. Below: two InsightCards showing `energyTrend` and `stressTrend` computed client-side by splitting the 7-day series in half and comparing means.
4. **Health metrics** — 4 InsightCards: avg weight, avg steps, avg water (ml), total exercise minutes over 7 days. Individual rows listed at the bottom.
5. **AI lifestyle insight** — a locale-aware template message chosen by a simple rules engine. No live AI call. Always accompanied by the *"not medical advice"* disclaimer.
6. **Recent entries** — last 7 days of health metrics as compact cards.

Empty states:

- No sleep log → `<EmptyState/>` pointing at the Check-in button.
- No mood today → EmptyState + prompt.
- No metrics → 4 InsightCards show `—`; recent list is hidden.

Pull-to-refresh re-runs all three queries in parallel.

#### Lifestyle insight rules (no AI call)

```
avgSleepHours  = null   →  "Log a few more days so I can suggest something specific."
avgSleepHours  < 6      →  "Your 7-day average is under 6 hours. A 30-min earlier phone-down tonight would be a small start."
stressTrend    = UP     →  "Stress has been trending up. A 15-min mid-afternoon break can help."
energyTrend    = DOWN   →  "Energy is trending down. Consider pushing low-priority items so you can spend focus on what matters."
otherwise              →  "Things look steady. Keep the rhythm — and take real breaks."
```

Always followed by the disclaimer: *"Lifestyle guidance only — not a substitute for medical advice. If symptoms persist, please consult a healthcare professional."*

Design choice: this keeps the home screen snappy and insulates from AI quota/provider failures. Deeper, personalized advice still lives under `/assistant/generate-daily-review` and `/ai/analyze-finance`.

### SleepMoodCheckinScreen

Location: `apps/mobile/src/screens/today/SleepMoodCheckinScreen.tsx`.

Bottom-of-modal-stack. On mount pre-fetches yesterday's sleep + today's mood to seed the form — "Save" becomes "Update" when those exist so the user can edit without creating duplicates (server upserts by `(userId, date)` anyway, so retries are safe).

Fields:

- `sleepTime` + `wakeTime` — both HH:mm. Validated with `/^([01]\d|2[0-3]):[0-5]\d$/`. Auto-format inserts `:` at position 2.
- `quality` chip selector: VERY_BAD / BAD / NORMAL / GOOD / VERY_GOOD.
- `mood` chip selector: 6 options, localized labels.
- `energyLevel` + `stressLevel`: LOW / MEDIUM / HIGH chips.
- `note` multiline input.

#### Cross-day handling

`composeSleepWindow(sleepHHMM, wakeHHMM)` does the anchoring:

```
sameDay = sleep HH:mm <  wake HH:mm
  → sleepDate = today        wakeDate = today    (a nap or same-day sleep)
else (late-night sleep)
  → sleepDate = yesterday    wakeDate = today    (typical night-into-morning)
```

Duration is computed client-side as `(wakeMs - sleepMs) / 60000` and shown under the inputs as "Duration: N.N hours · spans the previous night" when anchored to yesterday. If the computation yields a non-positive number, Save is disabled and an inline error shows.

The `DailyScheduleStatus` sleep pair is then POSTed with:

```json
{ "date": "<sleepDate>", "sleepTime": "<ISO>", "wakeTime": "<ISO>", "quality": "..." }
```

Server's `SleepLogsService` re-computes `durationMinutes` itself from the same inputs — the client-side hint is purely a UX aid.

### HealthMetricScreen

Location: `apps/mobile/src/screens/health/HealthMetricScreen.tsx`.

Log-or-update today's `HealthMetric` row:

- Fetches `GET /health-metrics?from=today&to=today` to seed.
- If an entry exists → "Update" button → `PUT /health-metrics/:id`.
- Else → "Save" → `POST /health-metrics`.

Fields (all optional):

- `weightKg` — decimal-pad, accepts only digits + `.`
- `waterIntakeMl` — number-pad
- `steps` — number-pad
- `exerciseMinutes` — number-pad
- `note` — multiline

Validation: any non-empty field must parse to a positive number; otherwise a localized Alert names the offending field. Empty fields are submitted as `undefined` (server happily stores them as NULL).

Disclaimer repeated on the screen: *"These numbers help you see a trend — they are not a substitute for a medical check-up."*

## Integration with other modules

These logs are the raw data behind three other features:

- **Dashboard / Today** — `/api/dashboard/summary` reads the latest sleep + today's mood + today's meal/habit/health-metric counters.
- **AI schedule generation** — `AiPlannerService.collectGenerateContext` feeds latest sleep + latest mood into `buildGenerateSchedulePrompt` so the AI can place deep-work into the user's actual energy window.
- **Assistant signals** — `DailyMonitoringService` emits `UNDER_SLEPT_3D`, `STRESS_HIGH_RECURRING`, `SLEEP_CHECKIN_MISSING`, `MOOD_CHECKIN_MISSING` from these same tables.

All three consumers read Prisma directly; no additional client work needed beyond logging accurate data here.

## API surface

| Endpoint | Used by |
| --- | --- |
| `GET /api/sleep-logs?from=&to=` | HealthScreen + SleepMoodCheckin seed |
| `POST /api/sleep-logs` | SleepMoodCheckin save (server upsert per `(userId, date)`) |
| `GET /api/mood-logs?from=&to=` | HealthScreen + SleepMoodCheckin seed |
| `POST /api/mood-logs` | SleepMoodCheckin save (upsert) |
| `GET /api/health-metrics?from=&to=` | HealthScreen list + HealthMetric seed |
| `POST /api/health-metrics` | HealthMetric save (create) |
| `PUT /api/health-metrics/:id` | HealthMetric save (update existing) |

No new server endpoints needed for this round — the existing shapes already covered everything.

## Query keys

```
['sleep-logs', from, to]         // 7-day window on HealthScreen
['sleep-logs', 'seed', date]     // SleepMoodCheckin seed
['mood-logs', from, to]          // 7-day window on HealthScreen
['mood-logs', 'seed', date]      // SleepMoodCheckin seed
['health-metrics', from, to]     // HealthScreen list
['health-metrics', today]        // HealthMetric seed
['dashboard']                    // invalidated after every save
```

Save mutations invalidate both the specific list keys and `['dashboard']` so the home screen's InsightCards stay in sync.

## i18n

Three new namespaces across `vi.json` and `en.json`:

- **`health.*`** — HealthScreen content: section titles, stat labels, quality enum (VERY_BAD..VERY_GOOD), empty states, insight template messages, disclaimer. Plural-aware keys for `nights` (`nights_one` / `nights_other`).
- **`checkin.*`** — SleepMoodCheckinScreen: field labels, hints, invalid-time copy, duration hint with interpolation, moods + levels enums, update label.
- **`healthMetric.*`** — HealthMetricScreen: form labels, placeholders, update label, validation message, disclaimer.

All text routes through `t()`. Dates via `formatDateByLocale`. Numbers formatted inline (calories, minutes, kg) with unit strings from the locale files.

## Testing (manual)

1. Settings → Language → vi. Open Health tab. With the seeded demo user (5 days of sleep + mood, 5 health metrics), see averages + trend glyphs + today's mood block + 4 InsightCards.
2. Tap "Sleep & mood check-in" → modal opens pre-seeded with yesterday's sleep + today's mood. Change sleep time to `01:30`, wake to `08:00` → duration hint shows `6.5 hours · spans the previous night`. Save → returns to Health, latest sleep card updates.
3. Try sleep=`12:00`, wake=`10:00` → inline error + Save disabled.
4. Tap "Log metrics" → HealthMetric opens with today's row (if any). Enter weight = `68.5`, water = `2100`, steps = `9500`, exercise = `45` → Save → returns to Health, averages recompute after refetch.
5. Paste "abc" into weight → Alert "Weight must be a positive number." on Save.
6. Switch language to en → every label, chip, error, disclaimer, trend legend flips. Quality chips show "Very good" instead of "Rất tốt".
7. Airplane mode → Save → localized alert; nothing is lost on the form.
8. After check-in, open Dashboard → mood card shows today's values; sleep InsightCard now reads `x.x h`; the assistant's `MOOD_CHECKIN_MISSING` signal should disappear on next `run-daily-monitoring`.
