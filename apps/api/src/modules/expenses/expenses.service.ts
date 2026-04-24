import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NeedLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateExpenseInput = {
  walletId?: string | null;
  title: string;
  amount: number;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod?: string;
  needLevel?: NeedLevel;
  note?: string;
};

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export type ListExpensesQuery = {
  from?: string;
  to?: string;
  category?: string;
  needLevel?: NeedLevel;
  page: number;
  limit: number;
};

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: ListExpensesQuery) {
    const where: Prisma.ExpenseWhereInput = { userId };
    if (q.category) where.category = q.category;
    if (q.needLevel) where.needLevel = q.needLevel;
    if (q.from || q.to) {
      where.expenseDate = {};
      if (q.from) (where.expenseDate as Prisma.DateTimeFilter).gte = toDate(q.from);
      if (q.to) (where.expenseDate as Prisma.DateTimeFilter).lte = toDate(q.to);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Expense not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateExpenseInput) {
    if (input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    if (input.walletId) await this.assertWalletOwned(userId, input.walletId);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          userId,
          walletId: input.walletId ?? null,
          title: input.title,
          amount: input.amount,
          category: input.category,
          expenseDate: toDate(input.expenseDate),
          paymentMethod: input.paymentMethod ?? null,
          needLevel: input.needLevel ?? null,
          note: input.note ?? null,
        },
      });
      if (expense.walletId) {
        await tx.wallet.update({
          where: { id: expense.walletId },
          data: { balance: { decrement: expense.amount } },
        });
      }
      return expense;
    });
  }

  async update(userId: string, id: string, input: UpdateExpenseInput) {
    const existing = await this.getById(userId, id);
    if (input.amount !== undefined && input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    if (input.walletId) await this.assertWalletOwned(userId, input.walletId);

    return this.prisma.$transaction(async (tx) => {
      if (existing.walletId) {
        // Revert previous deduction.
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
      }

      const data: Prisma.ExpenseUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.amount !== undefined) data.amount = input.amount;
      if (input.category !== undefined) data.category = input.category;
      if (input.expenseDate !== undefined) data.expenseDate = toDate(input.expenseDate);
      if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
      if (input.needLevel !== undefined) data.needLevel = input.needLevel;
      if (input.note !== undefined) data.note = input.note;
      if (input.walletId !== undefined) {
        data.wallet = input.walletId
          ? { connect: { id: input.walletId } }
          : { disconnect: true };
      }

      const updated = await tx.expense.update({ where: { id }, data });

      if (updated.walletId) {
        await tx.wallet.update({
          where: { id: updated.walletId },
          data: { balance: { decrement: updated.amount } },
        });
      }
      return updated;
    });
  }

  async delete(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
      }
    });
  }

  private async assertWalletOwned(userId: string, walletId: string): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== userId) {
      throw new NotFoundException({ message: 'Wallet not found', errorCode: 'NOT_FOUND' });
    }
  }
}
