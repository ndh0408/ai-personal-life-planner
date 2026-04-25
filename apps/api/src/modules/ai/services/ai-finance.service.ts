import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService, briefAiError } from './ai-provider.service';
import { AiProviderResolverService } from './ai-provider-resolver.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import {
  FinanceAnalysisSchema,
  type FinanceAnalysis,
} from '../schemas/finance-analysis.schema';
import {
  buildFinanceAnalysisPrompt,
  buildFinanceAnalysisSystem,
  type FinanceAnalysisContext,
} from '../prompts/finance-analysis.prompt';

export interface AnalyzeFinanceInput {
  month: string; // "YYYY-MM"
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

function monthBounds(yyyyMm: string): { start: Date; end: Date } {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function fallback(locale: 'vi' | 'en'): FinanceAnalysis {
  if (locale === 'en') {
    return {
      totalIncome: 0,
      totalExpense: 0,
      remainingMoney: 0,
      budgetWarnings: [],
      spendingPatterns: [],
      savingSuggestions: ['Review last month spending and pick one category to reduce by 10%.'],
      debtSuggestions: [],
      salaryAllocationSuggestion: {
        needPercent: 50,
        wantPercent: 30,
        savePercent: 20,
        comment: 'Generic 50/30/20 template — personalized guidance unavailable right now.',
      },
      usefulAdvice: ['AI fallback used — results are generic.'],
    };
  }
  return {
    totalIncome: 0,
    totalExpense: 0,
    remainingMoney: 0,
    budgetWarnings: [],
    spendingPatterns: [],
    savingSuggestions: ['Hãy chọn 1 hạng mục chi tiêu tháng trước và thử giảm 10% tháng này.'],
    debtSuggestions: [],
    salaryAllocationSuggestion: {
      needPercent: 50,
      wantPercent: 30,
      savePercent: 20,
      comment: 'Mẫu phân bổ 50/30/20 chung — AI chưa thể tư vấn cá nhân hoá lúc này.',
    },
    usefulAdvice: ['AI đang tạm dùng phương án an toàn — kết quả hiện ở dạng chung.'],
  };
}

@Injectable()
export class AiFinanceService {
  private readonly logger = new Logger(AiFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly locale: LocaleService,
    private readonly resolver: AiProviderResolverService,
  ) {}

  async analyze(userId: string, input: AnalyzeFinanceInput, req: RequestLike) {
    const locale = await this.locale.forUser(userId, req);
    const ctx = await this.collect(userId, input.month);

    const system = buildFinanceAnalysisSystem(locale);
    const prompt = buildFinanceAnalysisPrompt(this.tpl, ctx);

    let analysis: FinanceAnalysis;
    let usedFallback = false;
    try {
      const completion = await this.resolver.completeForUser(userId, 'finance', {
        system,
        prompt,
        jsonMode: true,
        maxTokens: 2000,
        temperature: 0.3,
      });
      analysis = await this.json.parseAndValidate(completion.text, FinanceAnalysisSchema, {
        task: 'finance-analysis',
        system,
      });
    } catch (e) {
      this.logger.warn(`finance-analysis fell back: ${briefAiError(e)}`);
      analysis = fallback(locale);
      // Preserve real totals even on fallback
      analysis.totalIncome = ctx.totalIncome;
      analysis.totalExpense = ctx.totalExpense;
      analysis.remainingMoney = ctx.net;
      usedFallback = true;
    }

    // Always trust server-side math for these three fields.
    analysis.totalIncome = ctx.totalIncome;
    analysis.totalExpense = ctx.totalExpense;
    analysis.remainingMoney = ctx.net;

    return { analysis, context: ctx, locale, usedFallback };
  }

  private async collect(userId: string, month: string): Promise<FinanceAnalysisContext> {
    const { start, end } = monthBounds(month);

    const [profile, wallets, incomes, expenses, budgets, debts, savingGoals] =
      await this.prisma.$transaction([
        this.prisma.userProfile.findUnique({
          where: { userId },
          select: { monthlySalary: true, currency: true },
        }),
        this.prisma.wallet.findMany({ where: { userId }, select: { balance: true } }),
        this.prisma.income.findMany({
          where: { userId, incomeDate: { gte: start, lt: end } },
          orderBy: { incomeDate: 'desc' },
        }),
        this.prisma.expense.findMany({
          where: { userId, expenseDate: { gte: start, lt: end } },
        }),
        this.prisma.budget.findMany({ where: { userId } }),
        this.prisma.debt.findMany({ where: { userId, status: { not: 'CANCELLED' } } }),
        this.prisma.savingGoal.findMany({ where: { userId, status: 'ACTIVE' } }),
      ]);

    const currency = profile?.currency ?? 'VND';
    const walletsTotal = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const byCatMap = new Map<string, { amount: number; count: number }>();
    for (const e of expenses) {
      const key = e.category;
      const prev = byCatMap.get(key) ?? { amount: 0, count: 0 };
      prev.amount += Number(e.amount);
      prev.count += 1;
      byCatMap.set(key, prev);
    }
    const expensesByCategory = [...byCatMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount);

    const byNeedMap = new Map<string, number>();
    for (const e of expenses) {
      const key = e.needLevel ?? 'UNSPECIFIED';
      byNeedMap.set(key, (byNeedMap.get(key) ?? 0) + Number(e.amount));
    }
    const expensesByNeedLevel = [...byNeedMap.entries()].map(([needLevel, amount]) => ({
      needLevel,
      amount,
    }));

    const budgetsOverview = budgets.map((b) => {
      const spentForThis = expenses
        .filter((e) => e.category === b.category)
        .reduce((s, e) => s + Number(e.amount), 0);
      const pct = Number(b.amount) === 0 ? 0 : (spentForThis / Number(b.amount)) * 100;
      return {
        category: b.category,
        amount: Number(b.amount),
        spent: spentForThis,
        overThreshold: pct >= b.alertThresholdPercent,
      };
    });

    return {
      month,
      currency,
      monthlySalary: profile?.monthlySalary !== null && profile?.monthlySalary !== undefined
        ? Number(profile.monthlySalary)
        : null,
      walletsTotal,
      incomes: incomes.map((i) => ({
        title: i.title,
        amount: Number(i.amount),
        category: i.category,
        date: i.incomeDate.toISOString().slice(0, 10),
      })),
      expensesByCategory,
      expensesByNeedLevel,
      budgets: budgetsOverview,
      debts: debts.map((d) => ({
        title: d.title,
        remaining: Number(d.totalAmount) - Number(d.paidAmount),
        type: d.type,
      })),
      savingGoals: savingGoals.map((g) => ({
        title: g.title,
        target: Number(g.targetAmount),
        current: Number(g.currentAmount),
      })),
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
    };
  }
}
