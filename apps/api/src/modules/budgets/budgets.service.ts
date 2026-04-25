import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetPeriod, FinanceAction, FinanceEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, MoneyError, pctOf, serialiseMoney } from '../../common/finance/money';
import { FinanceAuditService } from '../finance-core/finance-audit.service';

export type CreateBudgetInput = {
  category: string;
  amount: number | string;
  currency?: string;
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
    spent: string; // serialised Decimal
    remaining: string;
    usedPercent: number;
    overThreshold: boolean;
    currency: string;
  };
};

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
  ) {}

  async list(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ startDate: 'desc' }, { category: 'asc' }],
    });
    return Promise.all(budgets.map((b) => this.withUsage(userId, b)));
  }

  async getById(userId: string, id: string): Promise<BudgetWithUsage> {
    const b = await this.prisma.budget.findUnique({ where: { id } });
    if (!b || b.deletedAt) {
      throw new NotFoundException({ message: 'Budget not found', errorCode: 'NOT_FOUND' });
    }
    if (b.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return this.withUsage(userId, b);
  }

  async create(userId: string, input: CreateBudgetInput) {
    const amount = safeMoney(input.amount);
    if (amount.isZero()) {
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
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { currency: true },
    });

    const b = await this.prisma.budget.create({
      data: {
        userId,
        category: input.category,
        amount,
        currency: (input.currency ?? profile?.currency ?? 'VND').toUpperCase(),
        period: input.period,
        startDate: start,
        endDate: end,
        alertThresholdPercent: input.alertThresholdPercent ?? 80,
      },
    });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.BUDGET,
      entityId: b.id,
      action: FinanceAction.CREATE,
      after: {
        id: b.id,
        category: b.category,
        amount: b.amount,
        currency: b.currency,
        period: b.period,
        startDate: b.startDate,
        endDate: b.endDate,
      },
    });
    return this.withUsage(userId, b);
  }

  async update(userId: string, id: string, input: UpdateBudgetInput) {
    const before = await this.prisma.budget.findUnique({ where: { id } });
    if (!before || before.userId !== userId) {
      throw new NotFoundException({ message: 'Budget not found', errorCode: 'NOT_FOUND' });
    }
    if (input.amount !== undefined) {
      const a = safeMoney(input.amount);
      if (a.isZero()) {
        throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
      }
    }
    const data: Prisma.BudgetUpdateInput = {};
    if (input.category !== undefined) data.category = input.category;
    if (input.amount !== undefined) data.amount = safeMoney(input.amount);
    if (input.currency !== undefined) data.currency = input.currency.toUpperCase();
    if (input.period !== undefined) data.period = input.period;
    if (input.startDate !== undefined) data.startDate = toDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = toDate(input.endDate);
    if (input.alertThresholdPercent !== undefined) {
      data.alertThresholdPercent = input.alertThresholdPercent;
    }
    const updated = await this.prisma.budget.update({ where: { id }, data });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.BUDGET,
      entityId: id,
      action: FinanceAction.UPDATE,
      before: {
        amount: before.amount,
        currency: before.currency,
        category: before.category,
      },
      after: { amount: updated.amount, currency: updated.currency, category: updated.category },
    });
    return this.withUsage(userId, updated);
  }

  async delete(userId: string, id: string) {
    const before = await this.prisma.budget.findUnique({ where: { id } });
    if (!before || before.userId !== userId || before.deletedAt) {
      throw new NotFoundException({ message: 'Budget not found', errorCode: 'NOT_FOUND' });
    }
    await this.prisma.budget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.BUDGET,
      entityId: id,
      action: FinanceAction.DELETE,
      before: { amount: before.amount, currency: before.currency, category: before.category },
    });
  }

  /**
   * Computes usage from the `expenses` table inside the budget's date range,
   * matching on category AND currency. Round-13 fix: previously a USD budget
   * would have counted VND expenses as if 1:1, blowing the usage% up.
   *
   * Decimal math is preserved end-to-end via Prisma.Decimal; we serialise to
   * fixed-2 string for the API surface so the mobile JSON parser doesn't
   * round at the cap.
   */
  private async withUsage(
    userId: string,
    b: NonNullable<Awaited<ReturnType<PrismaService['budget']['findUnique']>>>,
  ): Promise<BudgetWithUsage> {
    const agg = await this.prisma.expense.aggregate({
      where: {
        userId,
        deletedAt: null,
        category: b.category,
        currency: b.currency,
        expenseDate: { gte: b.startDate, lte: b.endDate },
      },
      _sum: { amount: true },
    });
    const spent = agg._sum.amount ?? new Prisma.Decimal(0);
    const remaining = b.amount.minus(spent);
    const usedPercent = pctOf(spent, b.amount);
    return {
      ...b,
      usage: {
        spent: serialiseMoney(spent),
        remaining: serialiseMoney(remaining),
        usedPercent,
        overThreshold: usedPercent >= b.alertThresholdPercent,
        currency: b.currency,
      },
    };
  }
}

function safeMoney(input: number | string | Prisma.Decimal): Prisma.Decimal {
  try {
    return money(input);
  } catch (e) {
    if (e instanceof MoneyError) {
      throw new BadRequestException({ message: e.message, errorCode: e.errorCode });
    }
    throw e;
  }
}
