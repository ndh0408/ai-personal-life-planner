# LifeOS AI — Home dashboard

The Home tab is the landing surface. One round-trip to
`GET /api/dashboard/summary` fills five cards; the kicker shows the date +
AI status; the hero adapts to whether the AI key is set up.

> Screen: `apps/mobile/src/screens/main/HomeScreen.tsx`
> Components: `apps/mobile/src/components/home/`
> Backend: `apps/api/src/modules/dashboard/`

---

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ KICKER (Sun 27 tháng 4)            [✨ AI]  ← status pill │
│                                                          │
│ Chào Huy                                ← greeting       │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Hero (conditional)                                   │ │
│ │  • aiEnabled=false → "Bật AI để bắt đầu" + CTA       │ │
│ │  • aiEnabled=true  → "Hôm nay bạn muốn làm gì?"      │ │
│ │                       + Ghi nhanh / Tạo lịch CTAs    │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Lối tắt                                                  │
│ [✎][💸][✓][✦][✨]   ← QuickActionsRow (horizontal scroll) │
│                                                          │
│ ┌─ Lịch hôm nay ───────────────────────────────────────┐ │
│ │ ✨ AI · 3/7 đã xong                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Chi tiêu ───────────────────────────────────────────┐ │
│ │ Hôm nay 75k          Số dư ví -75k (red)             │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Task tiếp theo ─────────────────────────────────────┐ │
│ │ Họp với An — 15:00 27/4                              │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Gợi ý của trợ lý ───────────────────────────────────┐ │
│ │ ⚠ "Đi khám sức khoẻ" đã quá hạn 2 ngày               │ │
│ └────────────────────────────────────────────────── × ──┘ │
│ ┌─ Mood & giấc ngủ ────────────────────────────────────┐ │
│ │ 💤 7h30 GOOD       🎯 STRESSED MEDIUM                │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Quick Capture textarea + Send button       ← footer  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Pull-to-refresh refetches the summary.
Offline banner appears when the query errors with no cached data.

---

## API

```
GET /api/dashboard/summary
→ {
    aiEnabled: boolean,
    todayPlan: { planId | null, totalItems, doneItems, aiGenerated },
    money:     { todayTotal, weekTotal, walletBalance, currency: 'VND' },
    nextTask:  { id, title, dueAt | null, priority } | null,
    topRecommendation: { id, type, title, content, priority } | null,
    moodSleep: { lastSleepMinutes, lastSleepQuality,
                 lastMood, lastEnergy } | nullish each,
    serverTime: ISO,
  }
```

`apps/api/src/modules/dashboard/dashboard.service.ts` does one parallel
`Promise.all` of nine reads and assembles the envelope. No AI calls.

---

## Card behaviour

| Card | Source | Empty state | Press behaviour |
|---|---|---|---|
| TodayPlan | `summary.todayPlan` | "Chưa có lịch — bấm Tạo lịch để bắt đầu." | Navigates to Today tab. |
| Money | `summary.money` | (always shows zeros if no spend) | Navigates to Money tab. Wallet balance turns danger red when negative. |
| NextTask | `summary.nextTask` | "Bạn không còn task tới hạn nào." | (none yet — round 11+ opens a Task detail sheet) |
| AssistantNudge | `summary.topRecommendation` | "Chưa có gợi ý mới." | Has a × dismiss action that PATCHes the rec to DISMISSED. |
| MoodSleep | `summary.moodSleep` | "Chưa có check-in nào — Quick Capture 'hôm nay hơi mệt' …" | (none yet) |

---

## Hero variants

`HomeHero.tsx`. Two paths driven by `aiEnabled` from the summary.

**No AI** — sienna-soft background card to draw attention:
```
  Bật AI để bắt đầu
  Dán API key OpenAI để mở Quick Capture, kế hoạch hôm nay
  và trợ lý cá nhân.
  [ Nhập API key ]              ← navigates to AISettings
```

**AI on** — surface card with two CTAs side-by-side:
```
  Hôm nay bạn muốn làm gì?
  [ Ghi nhanh ]   [ Tạo lịch ]
```

The "Ghi nhanh" button is a hint → the persistent Quick Capture bar at
the bottom is the actual entry. "Tạo lịch" navigates to the Today tab
where the timeline + generate button live.

---

## QuickActionsRow

Horizontal scroll. Five tiles, each with a glyph + label:

| Key | Glyph | Action |
|---|---|---|
| `capture` | ✎ | Focus the QuickCaptureBar. |
| `expense` | 💸 | Open the Expense quick form (round 11+). |
| `task` | ✓ | Open the Task quick form (round 11+). |
| `checkin` | ✦ | Open Mood/Sleep check-in (round 11+). |
| `askAi` | ✨ | Navigate to Assistant tab. Disabled (visually) when `aiEnabled=false`. |

Tiles are 110 pt wide, scrollable so adding more later doesn't cramp the row.

---

## States

- **Loading** — first paint with no cached summary: a single LoadingState
  spinner inside the card stack region. Hero + QuickActions render
  immediately so the user has something to interact with.
- **Empty** — each card owns its own empty copy (see table above). The
  whole screen never shows a single global empty state.
- **Error / offline** — when the summary query errors and no cached data
  exists, an OfflineBanner appears under the header. Cards stay in their
  loading skeleton until the next refresh succeeds.
- **Refresh** — pull down anywhere on the scroll → triggers
  `summary.refetch()`. Quick Capture confirm also calls `summary.refetch()`
  so the cards reflect a freshly inserted Expense.

---

## Localization

All strings live under `home.*` in `apps/mobile/src/i18n/locales/{vi,en}.json`.
Date formatting uses `toLocaleDateString` with `vi-VN` or `en-US`. Money
formatting uses `formatMoney()` from `utils/format.ts` (Hermes Intl with a
graceful fallback for very old devices).

---

## What's not yet wired

- A "Goals" card pulling from `UserProfile.mainGoals` (data is there, render
  pending — rounds 11+).
- Today's weather / context strip above the greeting.
- Notification permission banner if push isn't granted (push lands later).
