# LifeOS AI — Smart Entry (Round 15)

The "type one sentence, AI does the rest" surface. Replaces the per-kind
forms (chips, dropdowns, manual category) with a single text input and a
preview card. No more asking the user to pick *expense vs income*, *category*,
or *meal type* — the AI infers it.

> Mobile: `apps/mobile/src/screens/main/SmartEntryScreen.tsx`
> Backend pipeline: `apps/api/src/modules/capture/parsers/`
> Wire format: `packages/shared/src/capture.ts`

---

## What changed vs round 14

```
ROUND 14 (the "đần" version)              ROUND 15 (smart-first)
────────────────────────────────          ────────────────────────────────
[Add Expense screen]                      [SmartEntry screen]
 ├─ title input                            ├─ ONE multiline input
 ├─ amount input                           │   "phở 60k", "lương 15tr",
 ├─ category chips ←  hardcoded            │   "họp An mai 9h", "ngủ 7h"
 ├─ note input                             │
 └─ Save (only ever EXPENSE)               ▼
                                          POST /capture/parse (debounced 400ms)
[Add Task screen]                          ↓
 ├─ title input                           AI Preview Card  ←  source: RULE | OPENAI
 ├─ priority chips ←  hardcoded            ├─ kind icon + label
 ├─ due chips ←  hardcoded                 ├─ confidence %
 └─ Save                                   ├─ smart-formatted summary
                                           └─ all 6 kinds: EXPENSE / INCOME /
[Sleep+Mood screen]                                       MEAL / TASK / SLEEP / MOOD
 ├─ hours chips                            ↓
 ├─ quality chips                         POST /capture/confirm
 ├─ mood chips                             ↓
 └─ Save                                  Right table + wallet $transaction
                                          (EXPENSE −, INCOME +)
```

The Add* screens are still in the codebase as fallbacks but every entry
point now opens **SmartEntry** instead.

---

## Pipeline

```
text "lương 15tr"
  ▼
runRuleParsers (in order)
  IncomeParser   ← matches: "lương" + money → 0.93
  ExpenseParser  ← also matches money but at 0.7
  MealParser     ← no match
  TaskParser     ← no match
  SleepParser    ← no match
  MoodParser     ← no match
  ▼
highest confidence wins → INCOME
  ▼
if confidence < 0.7  → fall back to OpenAI
                      (user's own key, encrypted, 12s timeout)
                      strict JSON shape forced
  ▼
ParseHit { kind, source, confidence, fields, previewText }
  ▼
mobile renders preview card; user taps "Lưu"
  ▼
POST /capture/confirm
  switch (kind):
    EXPENSE → Expense.create + Wallet.balance --        (in $transaction)
    INCOME  → Income.create  + Wallet.balance ++        (in $transaction)
    MEAL    → MealLog.create
    TASK    → Task.create
    SLEEP   → SleepLog.create
    MOOD    → MoodLog.create
  ▼
audit row in QuickCapture (rawText + parsedActions JSON)
```

---

## Income detection (new)

`apps/api/src/modules/capture/parsers/income.parser.ts`

VN trigger words: `lương / thưởng / nhận / được trả / được nhận / được /
hoàn / hoàn tiền / tiền về / thu nhập / freelance / cổ tức / lãi` plus
English: `income / salary / bonus / paycheck / dividend`.

Income runs **before** Expense in the orchestrator, so "nhận lương 10tr"
beats raw "spend 10tr". Confidence 0.93 (income trigger + money is unambiguous).

Categories: `salary, bonus, freelance, gift, refund, investment, other`.
The OpenAI fallback maps `incomeCategory` → server-side category, with a
graceful fallback if the LLM uses the older expense category set.

---

## Expense category expansion

Was: `food / transport / utility / learning / health / clothes / other` (7).
Now: `food / transport / bills / shopping / health / learning /
entertainment / family / other` (9), with much richer keyword sets:

- **food**: + `mì, lẩu, nướng, gà, bò, thịt, sữa, bia, rượu, nhậu, highlands, starbucks, kfc, lotte, pizza`
- **transport**: + `be, gojek, vé tàu, vé máy bay, vé xe, flight`
- **bills** (was utility): + `gas, rác, tiền nhà, thuê nhà, điện thoại, gói cước, 4g, 5g`
- **health**: + `gym, tập, yoga, pt, massage, spa, bệnh viện, phòng khám`
- **shopping**: + `shopee, lazada, tiki, mall, mỹ phẩm, son, phấn`
- **entertainment** (new): `phim, rạp, cinema, karaoke, game, steam, netflix, spotify, concert, sự kiện`
- **family** (new): `mừng, cưới, sinh nhật, biếu, gửi mẹ, gửi bố, tặng, quà, lì xì`

When the rule pass returns < 0.7 the OpenAI fallback fires with a prompt
that knows all 9 expense categories + 7 income categories.

---

## Mobile UX

### SmartEntryScreen
- Modal slide-from-bottom from anywhere.
- Multiline text input, autofocus.
- 400ms debounce → `/capture/parse`.
- Preview card with:
  - Left border tinted by kind (red for EXPENSE, green for INCOME, etc.)
  - Glyph + Vietnamese label
  - "AI · 87%" or "Luật cứng · 92%"
  - Smart summary line (amount, category, time)
- One [Lưu] button → confirm → invalidate every read query → goBack.
- Per-mount `useRef` Idempotency-Key so a double-tap on Save still creates one row.

### MoneyScreen
- Range chips: today / week / month.
- Three stat cards: **Thu** (income, +), **Chi** (expense, -), **Còn lại** (net).
- The Net card flips background colour (green/red) by sign.
- Mixed timeline: each row coloured by kind, with `+` or `-` prefix on amount,
  inline delete with ConfirmModal.

### Home + Today
- Quick Actions Capture / Expense / Task all funnel into SmartEntry.
- Today's "+ Thêm gì đó" CTA → SmartEntry.
- Tasks list "+ Thêm gì đó" CTA → SmartEntry.

---

## Endpoints touched / added

| Method | Path | Notes |
|---|---|---|
| POST   | `/api/capture/parse`        | Now returns `INCOME` kind too. |
| POST   | `/api/capture/confirm`      | Switch handles `INCOME` → income table + wallet `++`. |
| GET    | `/api/incomes?range=…`      | New. Mirror of expenses, soft-delete + wallet refund (`--`). |
| POST   | `/api/incomes`              | New. Idempotency-Key honoured. |
| PUT    | `/api/incomes/:id`          | New. Wallet adjusts by **delta** in `$transaction`. |
| DELETE | `/api/incomes/:id`          | New. Soft delete + wallet `--`. |
| GET    | `/api/finance/timeline?range=…` | New. Merged feed: expense+income, rows + totals + net. |

---

## Smoke verified

```
demo@lifeos.local · wallet 8 450 000 ₫

POST /capture/parse  "lương 15tr"        → kind=INCOME conf=0.93 cat=salary
POST /capture/parse  "phở 60k"           → kind=EXPENSE conf=0.7  cat=food
POST /capture/parse  "thưởng tết 5tr"    → kind=INCOME conf=0.93 cat=bonus

POST /capture/confirm INCOME 15M          → wallet 23 450 000 ✓ (+15M)
GET  /finance/timeline?range=month        → income 37M, expense 1.523M, net 35.477M
                                            11 rows mixed by date desc

54/54 jest tests pass — 8 new for IncomeParser + expanded categories.
```

---

## Why this matters

- **No more chip carousels for taxonomy** — the user types and ships.
- **Income is a first-class concept** — wallet now reflects what came in,
  not just what went out.
- **Real personalization** — categories expanded 7 → 16 across both
  directions; OpenAI fallback handles the long tail.
- **One UX surface for 6 entry types** — fewer screens to maintain, less
  cognitive load on the user.
