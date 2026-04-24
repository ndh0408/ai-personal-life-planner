# Finance module — mobile

Complete personal-finance surface: month-level dashboard, six sub-domains (wallets, income, expenses, budgets, debts, saving goals), and an AI analyze-this-month entry point. All money formatting is locale-aware (`formatMoneyByLocale`); all Decimal values from the API are handled via `toNumber` / `parseMoneyInput` helpers to keep float noise out of display + inputs.

## Screens

### FinanceScreen (dashboard)

Location: `apps/mobile/src/screens/finance/FinanceScreen.tsx`.

Pulls 5 parallel queries (dashboard summary + wallets + budgets + debts + saving-goals). Refreshing re-runs all five. Sections:

1. **Month overview** — 6 `MoneyCard`s in 3 rows: Income / Expense, Remaining / Cash-on-hand (with savings-rate hint), I-owe / Owed-to-me. Below: a primary "AI analyze this month" button that pushes MonthlyFinanceReport.
2. **Budget warnings** — renders only when the dashboard payload carries `budgetWarnings`. Amber at ≥threshold, red at ≥100%.
3. **Wallets preview** — 3 top wallets as cards with name, type, balance. "View more" → WalletsScreen.
4. **Manage grid** — 6 nav tiles (Expense / Income / Budget / Debt / SavingGoals / Monthly report) each pushing the corresponding screen.
5. **Top saving goals** — average-progress line + 2 `ProgressCard`s for the top goals.

Empty-state rows render inline when a section has no data, with a quick "+ Add X" button so the first-use flow is one tap.

### Six list screens (existing, now with "+ Add" buttons)

Each was patched to add a header row with a title + `+ Add` button that pushes the matching modal. Existing list rendering kept:

- **WalletsScreen** — balance per wallet, active flag, currency.
- **IncomeScreen** — amount + 1-line meta (category · date), recurring badge.
- **ExpenseScreen** — amount + 1-line meta, needLevel badge.
- **BudgetScreen** — `ProgressCard` per budget with over-threshold tinting.
- **DebtScreen** — type + status badges, person, remaining amount, due date.
- **SavingGoalsScreen** — `ProgressCard` per goal with target date.

### Six add-screens (new, modal-presented)

All under `apps/mobile/src/screens/finance/Add*Screen.tsx`. Each is a tight single-screen form with validation, localized error copy, and rollback-by-inaction (we never optimistically patch the cache before the server succeeds).

| Screen | Required fields | Cross-cutting |
| --- | --- | --- |
| **AddWalletScreen** | name, type chip, starting balance, currency chip | 4 currency options; VND default |
| **AddIncomeScreen** | title, amount, date | category chip, source text, wallet chip (nullable), recurring toggle + custom rule |
| **AddExpenseScreen** | title, amount, category, date | 8 quick categories with emoji icons + custom-category input, needLevel chip, wallet chip with "wallet will adjust automatically" hint |
| **AddBudgetScreen** | category, amount | period (WEEKLY / MONTHLY) auto-computes start/end, alertThresholdPercent (1..200) |
| **AddDebtScreen** | type, title, totalAmount | personName, paidAmount (≤ total), dueDate, note |
| **AddSavingGoalScreen** | title, targetAmount | currentAmount, targetDate, priority chip, note |

On save each screen invalidates the relevant list keys + `['wallets']` (when balance is affected) + `['dashboard']` + `goBack()`.

### MonthlyFinanceReportScreen (already shipped)

Fires `POST /api/ai/analyze-finance { month }`. Renders salary allocation, spending patterns, budget warnings, saving suggestions, debt suggestions, and useful advice.

## Money helpers

Location: `apps/mobile/src/utils/money.ts`.

- `toNumber(value)` — string/number/null → safe finite number or 0. Used anywhere a Decimal-string from the API is fed into summation.
- `cleanDigits(raw)` — strip everything non-numeric (for step/integer inputs).
- `cleanDecimal(raw)` — keep digits + first `.` (for weight, etc.).
- `parseMoneyInput(raw)` — returns a non-negative number or `undefined`. Used by every Add screen's amount input.

The mobile app **never** sends back a computed Decimal that the server persists — server-side transactions are the source of truth for wallet balance, budget usage, debt remaining, and saving progress. Client-side numbers are only for display aggregation (sums for MoneyCards, etc.) where cent-precision doesn't matter.

## Wallet-balance integrity

Every income/expense mutation on the backend runs in a `prisma.$transaction` that atomically adjusts the linked wallet's balance. The mobile client:

- Doesn't touch the cache optimistically — if the POST fails, there's nothing to roll back because we never flipped the wallet row locally.
- On success, invalidates `['wallets']` + `['dashboard']` so every screen that shows a balance re-fetches the authoritative row.
- On failure, surfaces a localized Alert from `useErrorMessage()` (e.g. `errors.NOT_FOUND` if the wallet belongs to someone else — server's IDOR guard fires 404).

The product spec asked for "error rollback nếu tạo expense thất bại" — the strategy we chose is **no-optimistic-write** rather than optimistic-with-revert. Simpler, fewer edge cases, and the UI still feels fast because mutations complete in well under 300 ms against the local Postgres.

## Budget usage logic

Budgets are read-only-computed from expenses on the backend (`BudgetsService.withUsage`), so creating or deleting an expense invalidates `['budgets']` and the next fetch shows the new `usedPercent` + `overThreshold`. No mobile-side aggregation.

## AI analyze-finance

Same endpoint (`POST /api/ai/analyze-finance`) the MonthlyFinanceReportScreen already wires. No additional server work needed for this round. Safety guardrails inherited from `BASE_GUARDRAILS`:

- No investment recommendations with promised returns.
- No tax/legal guidance.
- Keeps to budgeting + reducing waste + emergency funds + structured debt payoff.
- Server always overrides `totalIncome/totalExpense/remainingMoney` with the authoritative aggregates so the narrative can't lie about the numbers.

FinanceScreen's month overview button pushes MonthlyFinanceReport — no duplicated UI for the analysis.

## Navigation surface

New routes in `RootStackParamList`: `AddWallet`, `AddIncome`, `AddExpense`, `AddBudget`, `AddDebt`, `AddSavingGoal`. All modal-presented (`presentation: 'modal'`) so they slide up over the list screens. Back navigation returns to the list, which re-fetches via invalidation.

## i18n

Extended namespaces across both `vi.json` and `en.json`:

- `finance.overview.*` — month dashboard headers, income/expense/remaining/cash/iOwe/owedToMe + savings rate template.
- `finance.manage` / `finance.addWallet` / `finance.addIncome` / ... — nav labels.
- `wallets.*` — types enum, createTitle, form fields, invalid-name copy.
- `incomes.*` — categories enum (salary/freelance/bonus/gift/other), form fields, recurring copy, createTitle, invalid.
- `expenses.*` — 8 quick categories, needLevels enum, form fields, wallet-adjusts hint, custom category.
- `budgets.*` — periods enum, threshold hint, form fields, invalid.
- `debts.*` — form, createTitle, invalid.
- `savings.*` — form, createTitle, invalid.

Every label, chip, placeholder, error message, and disclaimer routes through `t()`; all currency displays go through `formatMoneyByLocale` with the currency pulled from the wallet/profile.

## Query-key map

```
['dashboard', 'summary']    // month totals + budget warnings
['wallets']                 // wallet list + FinanceScreen preview
['incomes']
['expenses']                // list screen only
['budgets']
['debts']
['saving-goals']
```

Mutations invalidate the union of their own key + `['wallets']` (if walletId is in play) + `['dashboard']`.

## Testing (manual)

1. Settings → Language → vi. Open Finance tab. Seed data: 4 wallets, 2 incomes, 8 expenses, 4 budgets (shopping at 240%), 2 debts, 3 saving goals, 1 financial snapshot. See the 6 MoneyCards with numbers; shopping warning appears red.
2. Tap "AI analyze this month" → MonthlyFinanceReport renders in-locale with allocation + suggestions.
3. Tap Expense nav tile → list with "+ Add expense" header → modal opens → pick quick category "Food" + amount "85000" + Cash wallet → Save → expense appears in list, Cash balance drops by 85 000.
4. Try amount "0" → inline Alert.
5. Try expense with wallet but offline → localized error alert, expense + wallet unchanged.
6. Add a budget for "food" at "4000000" monthly, threshold 80 → progress card appears with the % based on the month-to-date food spend (including the new expense from step 3).
7. Add a debt type "I_OWE" with paid > total → validation alert.
8. Record a saving-goal contribute via existing `PATCH /saving-goals/:id/contribute` (Add screen creates; list screen's progress card updates after back-navigation).
9. Switch language to en → every label flips including need-level enum and category labels.
