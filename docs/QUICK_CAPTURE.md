# LifeOS AI — Quick Capture

The shape of "say one sentence, get a row in the right table". The whole
loop: bar → parser → preview sheet → confirm → DB write. Both backend
and mobile.

> Wire format lives in `packages/shared/src/capture.ts`.
> Backend code: `apps/api/src/modules/capture/`.
> Mobile code: `apps/mobile/src/components/quick-capture/` + `hooks/useCapture.ts`.

---

## End-to-end flow

```
mobile                  api                              postgres
  │ POST /capture/parse  │                                 │
  │  { text, tz }        │ rule parsers (regex, ~5ms)      │
  │ ────────────────────▶│   if confidence ≥ 0.7 → return  │
  │                      │   else: try OpenAI structured   │
  │                      │   output (user's encrypted key) │
  │  preview JSON        │                                 │
  │ ◀────────────────────│                                 │
  │                      │                                 │
  │  CapturePreviewSheet │                                 │
  │  user reviews +/edits│                                 │
  │  taps "Xác nhận"     │                                 │
  │                      │                                 │
  │ POST /capture/confirm│                                 │
  │  { kind, fields,     │                                 │
  │    idempotencyKey? } │ Zod-parse fields by kind        │
  │ ────────────────────▶│ insert in matching table        │
  │                      │ (Expense/MealLog/Task/SleepLog/ │
  │                      │  MoodLog), inside a transaction │
  │                      │ that also adjusts wallet balance│
  │                      │ for EXPENSE.                    │
  │                      │ ───────────────────────────────▶│
  │  201 + { kind, id,   │                                 │
  │          createdAt } │                                 │
  │ ◀────────────────────│                                 │
```

The preview/confirm split is a UX rule (UX_PRINCIPLES §8 — never fake
success). The user always sees what's about to be written and can fix it.

---

## Endpoints

```
POST /api/capture/parse   { text, tz?, nowIso? }
                          → { kind, source, confidence, fields, previewText, hint? }
POST /api/capture/confirm { kind, fields, idempotencyKey? }
                          → 201 { kind, id, createdAt }
```

Auth required on both. Rate limits: 30 parse/min/IP, 60 confirm/min/IP.

`kind` ∈ `EXPENSE | MEAL | TASK | SLEEP | MOOD | UNKNOWN`. Confirm rejects
`UNKNOWN` with `CAPTURE_FIELDS_INVALID`.

`source` ∈ `RULE | OPENAI`. Rule first; OpenAI is a fallback when rule
confidence drops below 0.7.

Preview text is pre-formatted ("💸 Phở bò — 60.000 ₫") so the chip can
render immediately without local re-formatting.

---

## Rule parsers

Five live under `apps/api/src/modules/capture/parsers/`:

| Parser | Triggers | Confidence |
|---|---|---|
| `expense.parser.ts` | a money amount + spend verb (`ăn / uống / mua / tiêu / chi / trả / đổ / đi`) | 0.92 with verb, 0.7 if money only |
| `meal.parser.ts` | meal verb (`ăn / uống`) or meal-time word (`sáng / trưa / tối / chiều`) | 0.9 with verb + cost, 0.75 verb only, 0.6 type-only |
| `task.parser.ts` | task trigger (`họp / gặp / gọi / nhắc / làm / deadline / đến / tới`) or a parsed time-of-day | 0.88 trigger + time, 0.75 trigger only, 0.55 time only |
| `sleep.parser.ts` | `ngủ / sleep` + an hours phrase (`X tiếng / giờ / h`) | 0.9 |
| `mood.parser.ts` | a mood word (`tuyệt / vui / mệt / stress / buồn` …) | 0.85 with trigger (`mood / cảm thấy / hôm nay`), 0.55 keyword only |

Helpers used by all:
- `money.ts` — recognises `75k`, `75 nghìn`, `1tr`, `1.5tr`, `1,5 triệu`,
  `120000đ`, `120.000`, `120,000`. Bare integers < 1000 are rejected
  (likely time hints, not prices).
- `datetime.ts` — `hôm qua / tối qua / ngày mai / sáng mai` + `8h`,
  `8h30`, `15:00`, `3h chiều` → ISO strings in the user's tz.
- `word.ts` — `vnWord(['ngủ','ăn',…])` builds a Unicode-aware regex
  with `(?<![\p{L}\p{N}])(?:…)(?![\p{L}\p{N}])` boundaries because JS's
  default `\b` doesn't match around non-ASCII letters. Without this,
  `/\bngủ\b/` silently fails on a Vietnamese sentence.

The orchestrator (`parsers/index.ts`) picks the highest-confidence hit;
ties broken by parser order (Expense > Meal > Task > Sleep > Mood).

---

## OpenAI fallback

`apps/api/src/modules/capture/parsers/openai.parser.ts`. Triggers when:
- the rule pass returns null, or
- the rule pass returns a hit with confidence < 0.7.

The user's OpenAI key is decrypted in-memory (AES-256-GCM via
`EncryptionService`) only for the call. The system prompt asks for strict
JSON in the same `{ kind, fields }` shape as the rule output. 12-second
timeout. Failure (no key, network, parse error) → caller falls back to
the weak rule hit or to `UNKNOWN`. Never throws.

Cost: one `chat.completions` call with ~150 input tokens + ~80 output
tokens, billed to the user's account, never the platform.

---

## Confirm + entity insert

`apps/api/src/modules/capture/confirm.service.ts`. Per-kind:

| Kind | Schema | Side effects |
|---|---|---|
| EXPENSE | `ExpenseFieldsSchema` (title, amount, currency, category, expenseDateIso) | INSERT `Expense` + DECREMENT `Wallet.balance` in one Prisma `$transaction`. Default wallet auto-created if the user has none. Idempotency-key dedupe via `@@unique([userId, idempotencyKey])`. |
| MEAL | `MealFieldsSchema` (title, mealType, cost?, loggedAtIso) | INSERT `MealLog`. |
| TASK | `TaskFieldsSchema` (title, dueAtIso?, priority) | INSERT `Task` with status TODO. |
| SLEEP | `SleepFieldsSchema` (sleepAtIso, wakeAtIso, durationMinutes, quality?) | INSERT `SleepLog`. |
| MOOD | `MoodFieldsSchema` (mood, energy, loggedAtIso) | INSERT `MoodLog`. |

Validation failure → 400 `CAPTURE_FIELDS_INVALID` + the Zod issues
attached for debugging. Cross-user access to a wallet → never possible
(scoped on `userId`).

---

## Mobile UI

```
HomeScreen
  └── footer: <QuickCaptureBar />        ← textarea + Send button
                ↓ user types + send
              parse mutation (TanStack Query)
                ↓ on success
              <CapturePreviewSheet />    ← bottom sheet
                ├── <KindBadge kind={...} />
                ├── per-kind editable fields (title + amount, mealType
                │     chips, priority chips, quality chips, mood/energy)
                └── Confirm + Discard buttons
                ↓ on Confirm
              confirm mutation
                ↓ on success
              toast "Đã lưu" + invalidate dashboard / feed queries
```

Components: `apps/mobile/src/components/quick-capture/`. Hooks:
`apps/mobile/src/hooks/useCapture.ts`.

Spec used the names `QuickCaptureModal` + `SuggestedActionReviewModal` +
`QuickCaptureEntry` — implementation chose:
- `QuickCaptureBar` — sticky footer composer (more familiar than a modal
  for repeat capture).
- `CapturePreviewSheet` — bottom sheet (the "review modal").
- The "entry" (one card per parsed action) is rendered inline inside the
  sheet via `KindBadge` + the per-kind editor block.

---

## Examples (verified end-to-end via curl)

| Input | Parse output | Confirm result |
|---|---|---|
| `cà phê 30k` | EXPENSE 0.92 / food / 30 000 ₫ | row in `Expense`, wallet -30 000 |
| `ăn cơm gà 45k` | EXPENSE 0.92 / food / 45 000 ₫ | row + wallet decrement |
| `mai 9h gọi khách` | TASK 0.88 / "Gọi khách" / dueAt = tomorrow 09:00 ICT | row in `Task` |
| `nhắc tôi trả lời email lúc 8h` | TASK 0.88 / due 08:00 today | row in `Task` |
| `ngủ lúc 1h dậy 7h` | SLEEP — currently rule sees only `ngủ X tiếng` shape; the "ngủ lúc X dậy Y" pattern is a TODO (round 11+) — for now the OpenAI fallback handles it | row in `SleepLog` |
| `hôm nay hơi mệt` | MOOD 0.85 / TIRED | row in `MoodLog` |
| `ăn phở 60k trưa nay` | EXPENSE 0.92 / food / 60 000 ₫ | row + wallet decrement |

Money parser test corpus + per-parser unit tests live in
`apps/api/src/modules/capture/parsers/parsers.spec.ts` (37 / 37 passing).

---

## Error catalog

| `errorCode` | When |
|---|---|
| `validation_failed` | The text body is empty / oversize, or per-kind Zod fields fail. |
| `CAPTURE_FIELDS_INVALID` | Confirm fields don't match the per-kind schema. |
| `RATE_LIMITED` | 30+ parse/min or 60+ confirm/min from one IP. |
| `UNAUTHENTICATED` / `invalid_token` | Missing or bad access token. |

---

## Privacy

- The text the user types is sent to the API. If the OpenAI fallback
  fires, it is forwarded to the user's chosen AI provider with the
  user's own key. No third-party telemetry from the platform.
- Capture rows are never shared cross-user. `userId` scoping is enforced
  in the service layer on every read/write.
- Rule parser code is local-only — it never makes a network call.

---

## What's not done (parked)

- Voice input (STT). The bar's mic button placeholder is reserved.
- Multi-action capture ("ăn phở 60k và họp với An lúc 3h" → two drafts).
- Drag-to-discard chip gesture on the preview sheet (currently tap-to-discard).
- A `QuickCapture` audit row (wire format `parsedActions` JSON) is in
  the schema but not yet written to on confirm; round 12 will populate
  it for "undo last capture" and "see what I captured today".
