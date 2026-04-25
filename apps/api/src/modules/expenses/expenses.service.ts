import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceAction, FinanceEntityType, NeedLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, MoneyError } from '../../common/finance/money';
import { FinanceAuditService } from '../finance-core/finance-audit.service';
import { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

export type CreateExpenseInput = {
  walletId?: string | null;
  title: string;
  amount: number | string;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod?: string;
  needLevel?: NeedLevel;
  note?: string;
  currency?: string;
};

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export type ListExpensesQuery = {
  from?: string;
  to?: string;
  category?: string;
  needLevel?: NeedLevel;
  currency?: string;
  page: number;
  limit: number;
};

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly idempotency: FinanceIdempotencyService,
  ) {}

  async list(userId: string, q: ListExpensesQuery) {
    const where: Prisma.ExpenseWhereInput = { userId, deletedAt: null };
    if (q.category) where.category = q.category;
    if (q.needLevel) where.needLevel = q.needLevel;
    if (q.currency) where.currency = q.currency.toUpperCase();
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
    if (!row || row.deletedAt) {
      throw new NotFoundException({ message: 'Expense not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateExpenseInput, opts: { idempotencyKey?: string } = {}) {
    const amount = safeMoney(input.amount);
    if (amount.isZero()) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }

    if (opts.idempotencyKey) {
      const found = await this.idempotency.lookup(userId, 'expense:create', opts.idempotencyKey);
      if (found) return this.getById(userId, found.entityId);
    }

    // Resolve effective currency BEFORE the transaction so we don't keep the
    // wallet row locked while we figure out the user's primary currency.
    const wallet = input.walletId
      ? await this.assertWalletOwned(userId, input.walletId)
      : null;
    const currency = await this.resolveCurrency(userId, input.currency, wallet);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          userId,
          walletId: input.walletId ?? null,
          title: input.title,
          amount,
          currency,
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
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.EXPENSE,
        entityId: expense.id,
        action: FinanceAction.CREATE,
        after: snapshot(expense),
      });
      if (opts.idempotencyKey) {
        await this.idempotency.record({
          userId,
          scope: 'expense:create',
          key: opts.idempotencyKey,
          entityType: FinanceEntityType.EXPENSE,
          entityId: expense.id,
          tx,
        });
      }
      return expense;
    });
  }

  async update(userId: string, id: string, input: UpdateExpenseInput) {
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
      // Revert old wallet effect — uses the OLD walletId regardless of what
      // the update specifies.
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
      }

      const data: Prisma.ExpenseUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.amount !== undefined) data.amount = safeMoney(input.amount);
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
      if (input.currency !== undefined || wallet) {
        data.currency = newCurrency;
      }

      const updated = await tx.expense.update({ where: { id }, data });

      if (updated.walletId) {
        await tx.wallet.update({
          where: { id: updated.walletId },
          data: { balance: { decrement: updated.amount } },
        });
      }
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.EXPENSE,
        entityId: id,
        action: FinanceAction.UPDATE,
        before: snapshot(existing),
        after: snapshot(updated),
      });
      return updated;
    });
  }

  /**
   * Soft delete (round 14): sets deletedAt instead of removing the row, but
   * still reverses the wallet balance so the user's "money I have" line
   * doesn't keep counting a deleted expense.
   */
  async delete(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      if (existing.walletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
      }
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.EXPENSE,
        entityId: id,
        action: FinanceAction.DELETE,
        before: snapshot(existing),
      });
    });
  }

  /**
   * Restore a soft-deleted expense. Re-applies the wallet decrement so
   * accounting stays consistent. Errors with `NOT_FOUND` if the row was
   * never deleted.
   */
  async restore(userId: string, id: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException({ message: 'Expense not found', errorCode: 'NOT_FOUND' });
    }
    if (!row.deletedAt) {
      throw new NotFoundException({ message: 'Expense is not deleted', errorCode: 'NOT_FOUND' });
    }
    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.expense.update({
        where: { id },
        data: { deletedAt: null },
      });
      if (restored.walletId) {
        await tx.wallet.update({
          where: { id: restored.walletId },
          data: { balance: { decrement: restored.amount } },
        });
      }
      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.EXPENSE,
        entityId: id,
        action: FinanceAction.UPDATE,
        before: snapshot(row),
        after: snapshot(restored),
      });
      return restored;
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
  category: string;
  expenseDate: Date;
}): Record<string, unknown> {
  return {
    id: row.id,
    walletId: row.walletId,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    expenseDate: row.expenseDate,
  };
}
