import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceAction, FinanceEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, MoneyError } from '../../common/finance/money';
import { FinanceAuditService } from '../finance-core/finance-audit.service';
import { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

export type CreateIncomeInput = {
  walletId?: string | null;
  title: string;
  amount: number | string;
  category?: string;
  source?: string;
  incomeDate: string; // YYYY-MM-DD
  isRecurring?: boolean;
  recurringRule?: string;
  note?: string;
  currency?: string;
};

export type UpdateIncomeInput = Partial<CreateIncomeInput>;

export type RangeQuery = { from?: string; to?: string; category?: string; currency?: string };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class IncomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly idempotency: FinanceIdempotencyService,
  ) {}

  async list(userId: string, q: RangeQuery) {
    const where: Prisma.IncomeWhereInput = { userId };
    if (q.category) where.category = q.category;
    if (q.currency) where.currency = q.currency.toUpperCase();
    if (q.from || q.to) {
      where.incomeDate = {};
      if (q.from) (where.incomeDate as Prisma.DateTimeFilter).gte = toDate(q.from);
      if (q.to) (where.incomeDate as Prisma.DateTimeFilter).lte = toDate(q.to);
    }
    return this.prisma.income.findMany({
      where,
      orderBy: [{ incomeDate: 'desc' }, { createdAt: 'desc' }],
      take: 366,
    });
  }

  async getById(userId: string, id: string) {
    const income = await this.prisma.income.findUnique({ where: { id } });
    if (!income) throw new NotFoundException({ message: 'Income not found', errorCode: 'NOT_FOUND' });
    if (income.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return income;
  }

  async create(userId: string, input: CreateIncomeInput, opts: { idempotencyKey?: string } = {}) {
    const amount = safeMoney(input.amount);
    if (amount.isZero()) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }

    if (opts.idempotencyKey) {
      const found = await this.idempotency.lookup(userId, 'income:create', opts.idempotencyKey);
      if (found) return this.getById(userId, found.entityId);
    }

    const wallet = input.walletId
      ? await this.assertWalletOwned(userId, input.walletId)
      : null;
    const currency = await this.resolveCurrency(userId, input.currency, wallet);

    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          userId,
          walletId: input.walletId ?? null,
          title: input.title,
          amount,
          currency,
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
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.INCOME,
        entityId: income.id,
        action: FinanceAction.CREATE,
        after: snapshot(income),
      });
      if (opts.idempotencyKey) {
        await this.idempotency.record({
          userId,
          scope: 'income:create',
          key: opts.idempotencyKey,
          entityType: FinanceEntityType.INCOME,
          entityId: income.id,
          tx,
        });
      }
      return income;
    });
  }

  async update(userId: string, id: string, input: UpdateIncomeInput) {
    const existing = await this.getById(userId, id);
    if (input.amount !== undefined) {
      const a = safeMoney(input.amount);
      if (a.isZero()) {
        throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
      }
    }
    const wallet = input.walletId ? await this.assertWalletOwned(userId, input.walletId) : null;
    const newCurrency = input.currency
      ? input.currency.toUpperCase()
      : wallet
        ? wallet.currency
        : existing.currency;

    return this.prisma.$transaction(async (tx) => {
      // Revert old wallet effect.
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: existing.amount } },
        });
      }

      const data: Prisma.IncomeUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.amount !== undefined) data.amount = safeMoney(input.amount);
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
      if (input.currency !== undefined || wallet) {
        data.currency = newCurrency;
      }

      const updated = await tx.income.update({ where: { id }, data });

      if (updated.walletId) {
        await tx.wallet.update({
          where: { id: updated.walletId },
          data: { balance: { increment: updated.amount } },
        });
      }
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.INCOME,
        entityId: id,
        action: FinanceAction.UPDATE,
        before: snapshot(existing),
        after: snapshot(updated),
      });
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
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.INCOME,
        entityId: id,
        action: FinanceAction.DELETE,
        before: snapshot(existing),
      });
    });
  }

  private async assertWalletOwned(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== userId) {
      throw new NotFoundException({ message: 'Wallet not found', errorCode: 'NOT_FOUND' });
    }
    return wallet;
  }

  private async resolveCurrency(
    userId: string,
    explicit: string | undefined,
    wallet: { currency: string } | null,
  ): Promise<string> {
    if (explicit) return explicit.toUpperCase();
    if (wallet) return wallet.currency;
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { currency: true },
    });
    return (profile?.currency ?? 'VND').toUpperCase();
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

function snapshot(row: {
  id: string;
  walletId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  incomeDate: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    walletId: row.walletId,
    amount: row.amount,
    currency: row.currency,
    incomeDate: row.incomeDate,
  };
}
