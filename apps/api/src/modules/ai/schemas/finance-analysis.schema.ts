import { z } from 'zod';

export const FinanceAnalysisSchema = z.object({
  totalIncome: z.number(),
  totalExpense: z.number(),
  remainingMoney: z.number(),
  budgetWarnings: z
    .array(
      z.object({
        category: z.string().min(1).max(60),
        usagePercent: z.number(),
        message: z.string().min(1).max(500),
      }),
    )
    .max(30),
  spendingPatterns: z.array(z.string().min(1).max(500)).max(10),
  savingSuggestions: z.array(z.string().min(1).max(500)).max(10),
  debtSuggestions: z.array(z.string().min(1).max(500)).max(10),
  salaryAllocationSuggestion: z.object({
    needPercent: z.number().min(0).max(100),
    wantPercent: z.number().min(0).max(100),
    savePercent: z.number().min(0).max(100),
    comment: z.string().min(1).max(600),
  }),
  usefulAdvice: z.array(z.string().min(1).max(600)).max(10),
});
export type FinanceAnalysis = z.infer<typeof FinanceAnalysisSchema>;
