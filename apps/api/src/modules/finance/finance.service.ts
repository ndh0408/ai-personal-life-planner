import { Injectable } from '@nestjs/common';
import type { Expense } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  expenseDate: string;
  walletId: string;
  createdAt: string;
}

export interface ExpenseListResponse {
  range: RangeName | null;
  total: number;
  totalAmount: number;
  rows: ExpenseRow[];
}

export interface ExpenseSummary {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  /** Top categories this week (descending). */
  weekByCategory: Array<{ category: string; amount: number }>;
  currency: 'VND';
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, range: RangeName | null): Promise<ExpenseListResponse> {
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (range) {
      const { start, end } = rangeFor(range);
      where.expenseDate = { gte: start, lt: end };
    }
    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      take: 200,
    });
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return { range, total: rows.length, totalAmount, rows: rows.map(toRow) };
  }

  async summary(userId: string): Promise<ExpenseSummary> {
    const today = rangeFor('today');
    const week = rangeFor('week');
    const month = rangeFor('month');
    const where = (r: { start: Date; end: Date }) => ({
      userId,
      deletedAt: null,
      expenseDate: { gte: r.start, lt: r.end },
    });

    const [todayRows, weekRows, monthRows] = await Promise.all([
      this.prisma.expense.findMany({ where: where(today), select: { amount: true } }),
      this.prisma.expense.findMany({
        where: where(week),
        select: { amount: true, category: true },
      }),
      this.prisma.expense.findMany({ where: where(month), select: { amount: true } }),
    ]);

    const sum = (rows: { amount: { toString: () => string } }[]) =>
      rows.reduce((s, r) => s + Number(r.amount), 0);

    // Group week by category, sort by amount desc.
    const byCat = new Map<string, number>();
    for (const r of weekRows) {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount));
    }
    const weekByCategory = Array.from(byCat.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      todayTotal: sum(todayRows),
      weekTotal: sum(weekRows),
      monthTotal: sum(monthRows),
      weekByCategory,
      currency: 'VND',
    };
  }
}

function toRow(e: Expense): ExpenseRow {
  return {
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    // Expense rows inherit currency from their Wallet — MVP is VND-only,
    // multi-currency is phase 2 (PRODUCT_SPEC §6).
    currency: 'VND',
    category: e.category,
    expenseDate: e.expenseDate.toISOString(),
    walletId: e.walletId,
    createdAt: e.createdAt.toISOString(),
  };
}
