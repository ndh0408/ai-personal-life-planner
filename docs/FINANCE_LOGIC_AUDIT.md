# Finance Logic Audit (living)

This document tracks finance correctness issues across rounds. Updated after
Round 13.

## Closed in Round 13

| # | Issue | Closing change |
|--|--|--|
| 1 | Debt `addPayment` race | Conditional `updateMany` with previous-value check + `$transaction` |
| 2 | SavingGoal `contribute` race | Same conditional pattern + clamp-to-target |
| 3 | Multi-currency aggregation in dashboard | Primary-currency-only sums + per-currency wallet map + `mixedCurrencyDetected` |
| 4 | Decimal lossy in reports/dashboard/budgets | `Prisma.Decimal` end-to-end via `sumMoney` / `pctOf` helpers |
| 5 | Missing Idempotency-Key | `Idempotency-Key` header on expense/income/debt-pay/saving-contribute + `FinanceIdempotencyKey` table |
| 6 | No AuditLog | `FinanceAuditLog` table + `FinanceAuditService.record()` inside every write transaction |
| 9 | No decimal overpay tolerance on debt closeout | Comparison now exact via Decimal |

## Still open (round 14 backlog)

### F-7 Soft delete on finance entities — LOW
Today `delete()` on income/expense/wallet/debt/saving-goal hard-removes the
row; the audit log preserves the snapshot. A soft-delete column would let
the mobile UI offer an undo path without an audit-log read.

**Suggested fix:** add `deletedAt: DateTime?` on each table; update list/get
queries to filter `where: { deletedAt: null }`; dedicated `restore()` method.

### F-8 Timezone bug in daily reports — LOW
`reports.service.ts` `dayBounds()` uses server UTC midnight rather than the
user's timezone for the report's "today". A user in `Asia/Ho_Chi_Minh`
querying their daily report at 10pm ICT will get the wrong day's expenses
between midnight UTC (07:00 ICT) and noon ICT.

**Suggested fix:** read `userProfile.timezone` first, then compute
`dayBounds` against that timezone via the same `Intl` pattern used in
`AiUsageService.todayBoundsIn()`.

### F-FX Multi-currency display sums — LOW (informational)
We surface per-currency wallet totals + `mixedCurrencyDetected` but do NOT
convert to a unified primary-currency display. Mobile users with multiple
currencies see one of:
- Their primary currency only (current behaviour)
- A separate "Other currencies: USD 230.00" badge

A real FX layer requires:
- `ExchangeRate` table (date + base + quote + rate) sourced from a daily
  feed (e.g. exchangerate.host, ECB).
- A user setting "convert all to {primary}" toggle.
- Round-trip stability — rates must be snapshotted on the source row, not
  re-applied at read time.

This is product, not correctness. The current design is "honest" — we never
show a meaningless mixed-currency number.

## Idempotency scope

| Endpoint | Scope key | Notes |
|--|--|--|
| POST `/api/expenses` | `expense:create` | Returns the original row when key is reused |
| POST `/api/incomes` | `income:create` | Same |
| PATCH `/api/debts/:id/payment` | `debt:pay` | Returns the current debt row (no second increment) |
| PATCH `/api/saving-goals/:id/contribute` | `saving:contribute` | Returns the goal + `appliedAmount: '0.00'` to signal replay |

Mobile is expected to generate a uuid v4 per pending sync entry and send it
unchanged across retries.

## Audit log scope

`FinanceAuditService.record()` is called inside every write transaction with
`before` (existing row, omitted on CREATE) + `after` (new row, omitted on
DELETE). The serialiser excludes `note` (free-form, may contain PII) and
converts Decimal → fixed-2 string and Date → ISO string.

Query example:
```sql
SELECT action, before, after, "createdAt"
FROM finance_audit_logs
WHERE "userId" = $1 AND "entityType" = 'DEBT_PAYMENT' AND "entityId" = $2
ORDER BY "createdAt" DESC LIMIT 50;
```

## Test matrix (round 13)

- `money.spec.ts`: input validation, sumMoney, pctOf, approxEqual.
- `debts.service.spec.ts`: race-failure path (CONCURRENT_WRITE), idempotent payment.
- `saving-goals.service.spec.ts`: race-failure path, clamp-to-target.
- `expenses.service.spec.ts`: idempotent create.
- `budgets.service.spec.ts`: usage filters by currency.

Run: `cd apps/api && npm test -- --silent`.
