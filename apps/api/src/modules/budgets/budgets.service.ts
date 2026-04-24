import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateBudgetInput = {
  category: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  alertThresholdPercent?: number;
};

export type UpdateBudgetInput = Partial<CreateBudgetInput>;

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

type BudgetWithUsage = Awaited<ReturnType<PrismaService['budget']['findUnique']>> & {
  usage: {
    spent: number;
    remaining: number;
    usedPercent: number;
    overThreshold: boolean;
  };
};

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      orderBy: [{ startDate: 'desc' }, { category: 'asc' }],
    });
    return Promise.all(budgets.map((b) => this.withUsage(userId, b)));
  }

  async getById(userId: string, id: string): Promise<BudgetWithUsage> {
    const b = await this.prisma.budget.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ message: 'Budget not found', errorCode: 'NOT_FOUND' });
    if (b.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return this.withUsage(userId, b);
  }

  async create(userId: string, input: CreateBudgetInput) {
    if (input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    if (
      input.alertThresholdPercent !== undefined &&
      (input.alertThresholdPercent < 1 || input.alertThresholdPercent > 200)
    ) {
      throw new BadRequestException({
        message: 'alertThresholdPercent must be in [1,200]',
        errorCode: 'UNPROCESSABLE',
      });
    }
    const start = toDate(input.startDate);
    const end = toDate(input.endDate);
    if (end < start) {
      throw new BadRequestException({
        message: 'endDate must be >= startDate',
        errorCode: 'UNPROCESSABLE',
      });
    }

    const b = await this.prisma.budget.create({
      data: {
        userId,
        category: input.category,
        amount: input.amount,
        period: input.period,
        startDate: start,
        endDate: end,
        alertThresholdPercent: input.alertThresholdPercent ?? 80,
      },
    });
    return this.withUsage(userId, b);
  }

  async update(userId: string, id: string, input: UpdateBudgetInput) {
    await this.getById(userId, id);
    if (input.amount !== undefined && input.amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const data: Prisma.BudgetUpdateInput = {};
    if (input.category !== undefined) data.category = input.category;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.period !== undefined) data.period = input.period;
    if (input.startDate !== undefined) data.startDate = toDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = toDate(input.endDate);
    if (input.alertThresholdPercent !== undefined) {
      data.alertThresholdPercent = input.alertThresholdPercent;
    }
    const updated = await this.prisma.budget.update({ where: { id }, data });
    return this.withUsage(userId, updated);
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.budget.delete({ where: { id } });
  }

  /**
   * Computes usage from the `expenses` table in the budget's date range and
   * category. This stays cheap for typical monthly budgets (at most a few
   * hundred rows per category per month) and avoids a denormalized counter
   * that could drift from the authoritative expense ledger.
   */
  private async withUsage(
    userId: string,
    b: NonNullable<Awaited<ReturnType<PrismaService['budget']['findUnique']>>>,
  ): Promise<BudgetWithUsage> {
    const agg = await this.prisma.expense.aggregate({
      where: {
        userId,
        category: b.category,
        expenseDate: { gte: b.startDate, lte: b.endDate },
      },
      _sum: { amount: true },
    });
    const budgetAmount = Number(b.amount);
    const spent = Number(agg._sum.amount ?? 0);
    const remaining = budgetAmount - spent;
    const usedPercent = budgetAmount === 0 ? 0 : Math.round((spent / budgetAmount) * 10000) / 100;
    return {
      ...b,
      usage: {
        spent,
        remaining,
        usedPercent,
        overThreshold: usedPercent >= b.alertThresholdPercent,
      },
    };
  }
}
