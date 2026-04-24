import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS, buildLanguageDirective, type Locale } from './system';

export type FinanceAnalysisContext = {
  month: string; // "YYYY-MM"
  currency: string;
  monthlySalary: number | null;
  walletsTotal: number;
  incomes: Array<{ title: string; amount: number; category: string | null; date: string }>;
  expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  expensesByNeedLevel: Array<{ needLevel: string; amount: number }>;
  budgets: Array<{ category: string; amount: number; spent: number; overThreshold: boolean }>;
  debts: Array<{ title: string; remaining: number; type: 'I_OWE' | 'OWED_TO_ME' }>;
  savingGoals: Array<{ title: string; target: number; current: number }>;
  totalIncome: number;
  totalExpense: number;
  net: number;
};

export function buildFinanceAnalysisSystem(locale: Locale = 'vi'): string {
  return `${BASE_GUARDRAILS}

${buildLanguageDirective(locale)}

[task:finance-analysis]
You review the caller's personal finance state for a single month and return
practical wellness guidance. Output JSON:
{
  "totalIncome": number,
  "totalExpense": number,
  "remainingMoney": number,
  "budgetWarnings": [{"category":"string","usagePercent":number,"message":"string"}],
  "spendingPatterns": ["string",...],
  "savingSuggestions": ["string",...],
  "debtSuggestions": ["string",...],
  "salaryAllocationSuggestion": {
    "needPercent": number, "wantPercent": number, "savePercent": number,
    "comment": "string"
  },
  "usefulAdvice": ["string",...]
}

Strict rules:
- Personal-finance wellness only: budgeting, categorizing spending, reducing
  waste, growing an emergency fund, structured debt payoff.
- Do NOT recommend investment vehicles, crypto, forex, stocks, tax planning,
  or anything with promised returns. If asked, respond with a generic "please
  consult a qualified financial advisor" message in "usefulAdvice".
- Never shame or pressure the user. Frame suggestions as gentle options.
- Numbers returned must be plain numbers, not strings, in the user's currency.
- "usagePercent" is spent/budget * 100 rounded to 0 decimals.
- All narrative text fields MUST follow the Language directive above.`;
}

export function buildFinanceAnalysisPrompt(
  tpl: AiPromptTemplateService,
  ctx: FinanceAnalysisContext,
): string {
  const incomes = ctx.incomes
    .slice(0, 20)
    .map(
      (i, n) =>
        `<user-income-${n}>${tpl.sanitize(i.title, 80)} | ${i.amount} ${ctx.currency} | cat=${i.category ?? '?'} | ${i.date}</user-income-${n}>`,
    )
    .join('\n');

  const byCat = ctx.expensesByCategory
    .map((c) => `- ${c.category}: ${c.amount} ${ctx.currency} (${c.count} items)`)
    .join('\n');

  const byNeed = ctx.expensesByNeedLevel
    .map((n) => `- ${n.needLevel}: ${n.amount} ${ctx.currency}`)
    .join('\n');

  const budgetLines = ctx.budgets
    .map(
      (b) =>
        `- ${b.category}: ${b.spent}/${b.amount} ${ctx.currency}${b.overThreshold ? ' (OVER)' : ''}`,
    )
    .join('\n');

  const debtLines = ctx.debts
    .map((d) => `- [${d.type}] ${tpl.sanitize(d.title, 80)}: remaining ${d.remaining} ${ctx.currency}`)
    .join('\n');

  const savingLines = ctx.savingGoals
    .map(
      (g) =>
        `- ${tpl.sanitize(g.title, 80)}: ${g.current}/${g.target} ${ctx.currency} (${
          g.target === 0 ? 0 : Math.round((g.current / g.target) * 100)
        }%)`,
    )
    .join('\n');

  return [
    `Month: ${ctx.month}`,
    `Currency: ${ctx.currency}`,
    ctx.monthlySalary !== null ? `Stated monthly salary: ${ctx.monthlySalary} ${ctx.currency}` : '',
    `Wallets total: ${ctx.walletsTotal} ${ctx.currency}`,
    `Totals — income=${ctx.totalIncome}, expense=${ctx.totalExpense}, net=${ctx.net} ${ctx.currency}`,
    incomes ? `Incomes:\n${incomes}` : 'No incomes logged this month.',
    byCat ? `Expenses by category:\n${byCat}` : 'No expenses logged.',
    byNeed ? `Expenses by need-level:\n${byNeed}` : '',
    budgetLines ? `Budgets:\n${budgetLines}` : 'No budgets set.',
    debtLines ? `Debts:\n${debtLines}` : 'No active debts.',
    savingLines ? `Saving goals:\n${savingLines}` : 'No saving goals.',
    '',
    'Respond with JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
