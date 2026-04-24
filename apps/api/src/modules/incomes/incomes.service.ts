import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateIncomeInput = {
  walletId?: string | null;
  title: string;
  amount: number;
  category?: string;
  source?: string;
  incomeDate: string; // YYYY-MM-DD
  isRecurring?: boolean;
  recurringRule?: string;
  note?: string;
};

export type UpdateIncomeInput = Partial<CreateIncomeInput>;

export type RangeQuery = { from?: string; to?: string; category?: string };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class IncomesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: RangeQuery) {
    const where: Prisma.IncomeWhereInput = { userId };
    if (q.category) where.category = q.category;
    if (q.from || q.to) {
      where.incomeDate = {};
      if (q.from) (where.incomeDate as Prisma.DateTimeFilter).gte = toDate(q.from);
      if (q.to) (where.incomeDate as Prisma.DateTimeFilter).lte = toDate(q.to);
    }
    return this.prisma.income.findMany({
      where,
      orderBy: [{ incomeDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    const income = await this.prisma.income.findUnique({ where: { id } });
    if (!income) throw new NotFoundException({ message: 'Income not found', errorCode: 'NOT_FOUND' });
    if (income.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return income;
  }

  async create(userId: string, input: CreateIncomeInput) {
    if (input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    if (input.walletId) await this.assertWalletOwned(userId, input.walletId);

    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          userId,
          walletId: input.walletId ?? null,
          title: input.title,
          amount: input.amount,
          category: input.category ?? null,
          source: input.source ?? null,
          incomeDate: toDate(input.incomeDate),
          isRecurring: input.isRecurring ?? false,
          recurringRule: input.recurringRule ?? null,
          note: input.note ?? null,
        },
      });
      if (income.walletId) {
        await tx.wallet.update({
          where: { id: income.walletId },
          data: { balance: { increment: income.amount } },
        });
      }
      return income;
    });
  }

  async update(userId: string, id: string, input: UpdateIncomeInput) {
    const existing = await this.getById(userId, id);
    if (input.amount !== undefined && input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    if (input.walletId) await this.assertWalletOwned(userId, input.walletId);

    return this.prisma.$transaction(async (tx) => {
      // Revert old wallet effect, then apply new.
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: existing.amount } },
        });
      }

      const data: Prisma.IncomeUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.amount !== undefined) data.amount = input.amount;
      if (input.category !== undefined) data.category = input.category;
      if (input.source !== undefined) data.source = input.source;
      if (input.incomeDate !== undefined) data.incomeDate = toDate(input.incomeDate);
      if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
      if (input.recurringRule !== undefined) data.recurringRule = input.recurringRule;
      if (input.note !== undefined) data.note = input.note;
      if (input.walletId !== undefined) {
        data.wallet = input.walletId
          ? { connect: { id: input.walletId } }
          : { disconnect: true };
      }

      const updated = await tx.income.update({ where: { id }, data });

      if (updated.walletId) {
        await tx.wallet.update({
          where: { id: updated.walletId },
          data: { balance: { increment: updated.amount } },
        });
      }
      return updated;
    });
  }

  async delete(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.income.delete({ where: { id } });
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: existing.amount } },
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
