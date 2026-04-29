import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Expense } from '@prisma/client';
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
  note: string | null;
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
  weekByCategory: Array<{ category: string; amount: number }>;
  currency: 'VND';
}

export type TimelineEntryKind = 'EXPENSE' | 'INCOME';

export interface TimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  amount: number;
  category: string;
  occurredAt: string;
  walletId: string;
  note: string | null;
}

export interface TimelineResponse {
  range: RangeName | null;
  totalIncome: number;
  totalExpense: number;
  net: number;
  rows: TimelineEntry[];
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  category: string;
  expenseDateIso: string;
  walletId?: string;
  note?: string | null;
  idempotencyKey?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  amount?: number;
  category?: string;
  expenseDateIso?: string;
  note?: string | null;
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

  /**
   * Mixed expense + income feed for the Money tab. We fetch both, tag each
   * with a kind, and merge by date desc. Totals are sums per kind so the UI
   * can show "Thu / Chi / Còn lại" up top in one query.
   */
  async timeline(userId: string, range: RangeName | null): Promise<TimelineResponse> {
    const expenseWhere: Record<string, unknown> = { userId, deletedAt: null };
    const incomeWhere: Record<string, unknown> = { userId, deletedAt: null };
    if (range) {
      const { start, end } = rangeFor(range);
      expenseWhere.expenseDate = { gte: start, lt: end };
      incomeWhere.incomeDate = { gte: start, lt: end };
    }

    const [expenses, incomes] = await Promise.all([
      this.prisma.expense.findMany({
        where: expenseWhere,
        orderBy: { expenseDate: 'desc' },
        take: 200,
      }),
      this.prisma.income.findMany({
        where: incomeWhere,
        orderBy: { incomeDate: 'desc' },
        take: 200,
      }),
    ]);

    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);

    const rows: TimelineEntry[] = [
      ...expenses.map((e) => ({
        id: e.id,
        kind: 'EXPENSE' as const,
        title: e.title,
        amount: Number(e.amount),
        category: e.category,
        occurredAt: e.expenseDate.toISOString(),
        walletId: e.walletId,
        note: e.note,
      })),
      ...incomes.map((i) => ({
        id: i.id,
        kind: 'INCOME' as const,
        title: i.title,
        amount: Number(i.amount),
        category: i.category ?? 'other',
        occurredAt: i.incomeDate.toISOString(),
        walletId: i.walletId,
        note: i.note,
      })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return {
      range,
      totalExpense,
      totalIncome,
      net: totalIncome - totalExpense,
      rows: rows.slice(0, 200),
    };
  }

  async create(userId: string, input: CreateExpenseInput): Promise<ExpenseRow> {
    const wallet = await this.resolveWallet(userId, input.walletId);

    if (input.idempotencyKey) {
      const existing = await this.prisma.expense.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return toRow(existing);
    }

    const amount = new Prisma.Decimal(input.amount);
    const [row] = await this.prisma.$transaction([
      this.prisma.expense.create({
        data: {
          userId,
          walletId: wallet.id,
          title: input.title.trim(),
          amount,
          category: input.category,
          expenseDate: new Date(input.expenseDateIso),
          note: input.note?.trim() || null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
    ]);
    return toRow(row);
  }

  async update(userId: string, id: string, input: UpdateExpenseInput): Promise<ExpenseRow> {
    const existing = await this.assertOwn(userId, id);

    const newAmount =
      input.amount !== undefined ? new Prisma.Decimal(input.amount) : null;
    const data: Prisma.ExpenseUpdateInput = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.category !== undefined) data.category = input.category;
    if (input.expenseDateIso !== undefined) data.expenseDate = new Date(input.expenseDateIso);
    if (input.note !== undefined) data.note = input.note?.trim() || null;
    if (newAmount !== null) data.amount = newAmount;

    if (newAmount !== null && !newAmount.equals(existing.amount)) {
      // Wallet adjusts by the delta — positive delta = spent more, decrement.
      const delta = newAmount.minus(existing.amount);
      const [row] = await this.prisma.$transaction([
        this.prisma.expense.update({ where: { id }, data }),
        this.prisma.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: delta } },
        }),
      ]);
      return toRow(row);
    }

    const row = await this.prisma.expense.update({ where: { id }, data });
    return toRow(row);
  }

  async softDelete(userId: string, id: string): Promise<{ id: string }> {
    const existing = await this.assertOwn(userId, id);
    // Soft delete + refund the wallet.
    await this.prisma.$transaction([
      this.prisma.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.wallet.update({
        where: { id: existing.walletId },
        data: { balance: { increment: existing.amount } },
      }),
    ]);
    return { id };
  }

  private async assertOwn(userId: string, id: string): Promise<Expense> {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e || e.deletedAt) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Khoản chi không tồn tại.' },
      });
    }
    if (e.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Không có quyền với khoản chi này.' },
      });
    }
    return e;
  }

  private async resolveWallet(userId: string, walletId?: string) {
    if (walletId) {
      const w = await this.prisma.wallet.findUnique({ where: { id: walletId } });
      if (!w || w.deletedAt) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Ví không tồn tại.' },
        });
      }
      if (w.userId !== userId) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Không có quyền với ví này.' },
        });
      }
      return w;
    }
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, deletedAt: null, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.wallet.create({
      data: { userId, name: 'Ví chính', isDefault: true, currency: 'VND' },
    });
  }
}

function toRow(e: Expense): ExpenseRow {
  return {
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    currency: 'VND',
    category: e.category,
    expenseDate: e.expenseDate.toISOString(),
    walletId: e.walletId,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  };
}
