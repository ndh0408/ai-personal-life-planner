# Quick Capture UX — Round 20.5

**Goal:** "type one line, app routes it." Works *without* an AI key —
with an AI key it gets richer.

---

## Surfaces

### `QuickCaptureScreen` (rewritten — `screens/voice/QuickCaptureScreen.tsx`)

**Layout:**

1. Title + subtitle.
2. Multiline text input.
3. `Parse` button (full-width, primary).
4. Example chips (`cà phê 30k`, `mai 9h gọi khách`, …) — populate the
   input on tap so users can learn what shapes the parser handles.
5. Draft cards (one per detected intent) — each with `Confirm` /
   `Discard` buttons.
6. (When a provider exists) `Use AI for richer parsing` button —
   delegates to the existing backend `/ai/parse-quick-capture` route
   and routes results through `SuggestedActionsReviewScreen`.
7. Voice section — *coming soon* placeholder. No longer claims to work.

### Dashboard entry points

- Primary: **"Capture in one line"** hero card (always visible).
- Secondary: ⚡ **Quick capture** chip in the Quick Actions row.

---

## Rule-based parser

`apps/mobile/src/services/quickCapture/ruleParser.ts`

Local-only, runs on every `Parse` tap. Output is a list of `CaptureDraft`
unions:

```ts
type ExpenseDraft = { kind:'EXPENSE'; title; amount; category; expenseDate; … };
type TaskDraft    = { kind:'TASK';    title; dueDate?; … };
```

### Heuristics

**Money detection (expense):**
- `30k` / `45K` → ×1 000
- `1m` / `1.5M` → ×1 000 000
- `\$12.99` → USD
- Bare 4+ digit numbers (e.g. `50000`) → VND
- Bare numbers <1k are skipped unless tagged `đ` / `vnd`.

**Time / date hints (task):**
- `mai`, `tomorrow`, `tmr` → tomorrow at 09:00 local (or the parsed
  hour, if one was provided).
- `hôm nay`, `today`, `tối nay`, `tonight` → today.
- `9h`, `9 giờ`, `9:00`, `9am`, `9pm` → that hour today (or tomorrow
  if the hour has already passed).

**Category detection:**
- `cà phê`, `coffee`, `cơm`, `phở`, `lunch`, `dinner` → `food`
- `taxi`, `grab`, `xăng`, `bus` → `transport`
- `điện`, `nước`, `internet`, `tiền nhà` → `housing`
- `thuốc`, `doctor`, `khám` → `health`
- `mua`, `shopee`, `lazada` → `shopping`
- everything else → `other`

**Task triggers:**
- `nhắc`, `gọi`, `gửi`, `họp`, `remind`, `call`, `email`, `meet`, …

**Examples handled (per spec):**

| input | draft |
|-------|-------|
| `cà phê 30k` | EXPENSE Cà phê / 30 000 VND / food / today |
| `ăn cơm gà 45k` | EXPENSE Ăn cơm gà / 45 000 / food / today |
| `coffee 30k` | EXPENSE Coffee / 30 000 / food / today |
| `taxi 50000` | EXPENSE Taxi / 50 000 / transport / today |
| `mai 9h gọi khách` | TASK Gọi khách / due tomorrow 09:00 |
| `nhắc tôi trả lời email lúc 8h` | TASK Trả lời email / due today/tomorrow 08:00 |
| `tomorrow 9am call client` | TASK Call client / due tomorrow 09:00 |

### Confidence

Each draft carries `confidence: 'high' | 'medium'`. The UI shows a small
`~` info badge for medium-confidence drafts (no due-date hint in a
task, etc.).

### Edge cases

- Empty / 1-char input → returns `[]`.
- Both money and a strong task trigger → favours expense (e.g. "lunch
  45k" is an expense, not a task).
- No match → UI shows the `noDraft` empty card with re-prompt copy.

---

## Confirm flow

When the user taps `Confirm` on a draft:

- **EXPENSE** → `expensesApi.create({ title, amount, category,
  expenseDate, walletId: firstWallet?.id })`. The mobile auto-selects
  the user's first wallet so balances stay consistent.
- **TASK** → `tasksApi.create({ title, priority: 'MEDIUM', dueDate })`.

Both invalidate the relevant query keys + dashboard so the Home stats
update immediately. Errors are surfaced via the localised
`useErrorMessage()` hook — no raw HTTP shows up.

`Discard` removes the draft locally without any API call.

---

## What's NOT wired (deferred)

- **Voice STT.** The placeholder reads "coming in a later release." No
  more `transcribeStub` user-facing notice claiming text fallback.
- **Multi-intent parsing** (e.g. "cà phê 30k và mai 9h gọi khách").
  The parser returns the most confident single intent today; multi-
  intent will land when we wire AI parse for non-AI users too.
- **Confidence-based confirmation.** Today every draft requires
  confirmation; future iterations may auto-confirm `confidence:'high'`
  expenses.

## Files touched

- `apps/mobile/src/services/quickCapture/ruleParser.ts` — new.
- `apps/mobile/src/screens/voice/QuickCaptureScreen.tsx` — rewritten.
- `apps/mobile/src/screens/dashboard/DashboardScreen.tsx` — hero card +
  quick-action chip.
- `apps/mobile/src/i18n/locales/{en,vi}.json` — `settings.quickCapture.*`
  + `dashboard.captureCta.*` + `dashboard.quickActions.quickCapture`.
