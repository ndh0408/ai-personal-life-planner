import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DebtStatus, DebtType, FinanceAction, FinanceEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, moneyOrZero, MoneyError } from '../../common/finance/money';
import { FinanceAuditService } from '../finance-core/finance-audit.service';
import { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

export type CreateDebtInput = {
  type: DebtType;
  personName?: string;
  title: string;
  totalAmount: number | string;
  paidAmount?: number | string;
  currency?: string;
  dueDate?: string; // YYYY-MM-DD
  note?: string;
};

export type UpdateDebtInput = Partial<CreateDebtInput> & { status?: DebtStatus };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly idempotency: FinanceIdempotencyService,
  ) {}

  list(userId: string) {
    return this.prisma.debt.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.debt.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException({ message: 'Debt not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateDebtInput) {
    const total = safeMoney(input.totalAmount);
    if (total.isZero()) {
      throw new BadRequestException({ message: 'totalAmount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const paid = moneyOrZero(input.paidAmount);
    if (paid.greaterThan(total)) {
      throw new BadRequestException({
        message: 'paidAmount must be in [0, totalAmount]',
        errorCode: 'UNPROCESSABLE',
      });
    }
    const created = await this.prisma.debt.create({
      data: {
        userId,
        type: input.type,
        personName: input.personName ?? null,
        title: input.title,
        totalAmount: total,
        paidAmount: paid,
        currency: (input.currency ?? 'VND').toUpperCase(),
        dueDate: input.dueDate ? toDate(input.dueDate) : null,
        note: input.note ?? null,
        status: paid.greaterThanOrEqualTo(total) ? DebtStatus.PAID : DebtStatus.ACTIVE,
      },
    });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.DEBT,
      entityId: created.id,
      action: FinanceAction.CREATE,
      after: snapshot(created),
    });
    return created;
  }

  async update(userId: string, id: string, input: UpdateDebtInput) {
    const before = await this.getById(userId, id);
    const data: Prisma.DebtUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.personName !== undefined) data.personName = input.personName;
    if (input.title !== undefined) data.title = input.title;
    if (input.totalAmount !== undefined) data.totalAmount = safeMoney(input.totalAmount);
    if (input.paidAmount !== undefined) data.paidAmount = safeMoney(input.paidAmount);
    if (input.currency !== undefined) data.currency = input.currency.toUpperCase();
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? toDate(input.dueDate) : null;
    const updated = await this.prisma.debt.update({ where: { id }, data });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.DEBT,
      entityId: id,
      action: FinanceAction.UPDATE,
      before: snapshot(before),
      after: snapshot(updated),
    });
    return updated;
  }

  /**
   * PATCH /debts/:id/payment — record a payment against the debt.
   *
   * Race-safe via a conditional UPDATE:
   *   UPDATE debts SET paidAmount = paidAmount + amount, status = ...
   *     WHERE id = :id AND userId = :uid AND status != 'CANCELLED'
   *           AND paidAmount + amount <= totalAmount
   *
   * If the WHERE fails (concurrent payment already used the headroom, the
   * debt was cancelled, or the cumulative total would exceed totalAmount),
   * `updateMany` returns count=0 and we throw a deterministic error.
   *
   * Idempotent when `idempotencyKey` is provided: if the key was used the
   * existing debt row is returned untouched.
   */
  async addPayment(
    userId: string,
    id: string,
    amount: number | string,
    opts: { markPaid?: boolean; idempotencyKey?: string } = {},
  ) {
    const amt = safeMoney(amount);
    if (amt.isZero()) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }

    if (opts.idempotencyKey) {
      const found = await this.idempotency.lookup(userId, 'debt:pay', opts.idempotencyKey);
      if (found) {
        // Replay → return current row.
        return this.getById(userId, id);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.debt.findUnique({ where: { id } });
      if (!before) throw new NotFoundException({ message: 'Debt not found', errorCode: 'NOT_FOUND' });
      if (before.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
      if (before.status === DebtStatus.CANCELLED) {
        throw new BadRequestException({
          message: 'Cannot pay a cancelled debt',
          errorCode: 'UNPROCESSABLE',
        });
      }

      // Conditional update — Prisma's atomic increment plus a WHERE on the
      // pre-existing paidAmount makes this race-safe.
      const result = await tx.debt.updateMany({
        where: {
          id,
          userId,
          status: { not: DebtStatus.CANCELLED },
          // paidAmount must equal the value we just read, so a concurrent
          // payment will fail-then-rollback, and the user's mobile retries.
          paidAmount: before.paidAmount,
        },
        data: { paidAmount: { increment: amt } },
      });
      if (result.count === 0) {
        throw new BadRequestException({
          message: 'Concurrent debt payment detected; please retry',
          errorCode: 'CONCURRENT_WRITE',
        });
      }

      const after = await tx.debt.findUnique({ where: { id } });
      if (!after) {
        throw new NotFoundException({ message: 'Debt vanished mid-write', errorCode: 'NOT_FOUND' });
      }
      // Server-side overpay guard — never persist paidAmount > totalAmount.
      if (after.paidAmount.greaterThan(after.totalAmount)) {
        // Roll back by raising; $transaction discards changes.
        throw new BadRequestException({
          message: 'Payment exceeds remaining balance',
          errorCode: 'UNPROCESSABLE',
        });
      }
      const reached = after.paidAmount.greaterThanOrEqualTo(after.totalAmount);
      const finalRow = opts.markPaid || reached
        ? await tx.debt.update({ where: { id }, data: { status: DebtStatus.PAID } })
        : after;

      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.DEBT_PAYMENT,
        entityId: id,
        action: FinanceAction.PAY,
        before: snapshot(before),
        after: snapshot(finalRow),
      });
      if (opts.idempotencyKey) {
        await this.idempotency.record({
          userId,
          scope: 'debt:pay',
          key: opts.idempotencyKey,
          entityType: FinanceEntityType.DEBT_PAYMENT,
          entityId: id,
          tx,
        });
      }
      return finalRow;
    });
  }

  async delete(userId: string, id: string) {
    const before = await this.getById(userId, id);
    await this.prisma.debt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.DEBT,
      entityId: id,
      action: FinanceAction.DELETE,
      before: snapshot(before),
    });
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
  type: DebtType;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  currency: string;
  status: DebtStatus;
  dueDate: Date | null;
}): Record<string, unknown> {
  return {
    id: row.id,
    type: row.type,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    currency: row.currency,
    status: row.status,
    dueDate: row.dueDate,
  };
}
