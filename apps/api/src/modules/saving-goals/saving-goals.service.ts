import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceAction,
  FinanceEntityType,
  Prisma,
  Priority,
  SavingGoalStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, moneyOrZero, MoneyError } from '../../common/finance/money';
import { FinanceAuditService } from '../finance-core/finance-audit.service';
import { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

export type CreateSavingGoalInput = {
  title: string;
  targetAmount: number | string;
  currentAmount?: number | string;
  currency?: string;
  targetDate?: string;
  priority?: Priority;
  note?: string;
};

export type UpdateSavingGoalInput = Partial<CreateSavingGoalInput> & {
  status?: SavingGoalStatus;
};

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class SavingGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly idempotency: FinanceIdempotencyService,
  ) {}

  list(userId: string) {
    return this.prisma.savingGoal.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.savingGoal.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Saving goal not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateSavingGoalInput) {
    const target = safeMoney(input.targetAmount);
    if (target.isZero()) {
      throw new BadRequestException({ message: 'targetAmount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const current = moneyOrZero(input.currentAmount);
    const created = await this.prisma.savingGoal.create({
      data: {
        userId,
        title: input.title,
        targetAmount: target,
        currentAmount: current,
        currency: (input.currency ?? 'VND').toUpperCase(),
        targetDate: input.targetDate ? toDate(input.targetDate) : null,
        priority: input.priority ?? Priority.MEDIUM,
        note: input.note ?? null,
        status:
          current.greaterThanOrEqualTo(target)
            ? SavingGoalStatus.COMPLETED
            : SavingGoalStatus.ACTIVE,
      },
    });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.SAVING_GOAL,
      entityId: created.id,
      action: FinanceAction.CREATE,
      after: snapshot(created),
    });
    return created;
  }

  async update(userId: string, id: string, input: UpdateSavingGoalInput) {
    const before = await this.getById(userId, id);
    const data: Prisma.SavingGoalUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.targetAmount !== undefined) data.targetAmount = safeMoney(input.targetAmount);
    if (input.currentAmount !== undefined) data.currentAmount = safeMoney(input.currentAmount);
    if (input.currency !== undefined) data.currency = input.currency.toUpperCase();
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;
    if (input.targetDate !== undefined) {
      data.targetDate = input.targetDate ? toDate(input.targetDate) : null;
    }
    const updated = await this.prisma.savingGoal.update({ where: { id }, data });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.SAVING_GOAL,
      entityId: id,
      action: FinanceAction.UPDATE,
      before: snapshot(before),
      after: snapshot(updated),
    });
    return updated;
  }

  /**
   * PATCH /saving-goals/:id/contribute — race-safe contribution.
   *
   * Same conditional-update pattern as DebtsService.addPayment:
   *   UPDATE saving_goals SET currentAmount = currentAmount + amount
   *     WHERE id = :id AND userId = :uid AND status != 'CANCELLED'
   *           AND currentAmount = :previouslyReadValue
   *
   * If the WHERE fails, a concurrent contribution beat us — we throw
   * `CONCURRENT_WRITE` and the mobile sync queue retries (deterministic).
   *
   * Behaviour: contributions that would push currentAmount past the target
   * are CLAMPED at the target by default. We additionally return the
   * effective `applied` amount so the mobile UI can reconcile its optimistic
   * write with the server's clamped one.
   */
  async contribute(
    userId: string,
    id: string,
    amount: number | string,
    opts: { idempotencyKey?: string } = {},
  ): Promise<{ goal: Awaited<ReturnType<SavingGoalsService['getById']>>; appliedAmount: string }> {
    const requested = safeMoney(amount);
    if (requested.isZero()) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }

    if (opts.idempotencyKey) {
      const found = await this.idempotency.lookup(userId, 'saving:contribute', opts.idempotencyKey);
      if (found) {
        const goal = await this.getById(userId, id);
        return { goal, appliedAmount: '0.00' };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.savingGoal.findUnique({ where: { id } });
      if (!before) throw new NotFoundException({ message: 'Saving goal not found', errorCode: 'NOT_FOUND' });
      if (before.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
      if (before.status === SavingGoalStatus.CANCELLED) {
        throw new BadRequestException({
          message: 'Cannot contribute to a cancelled goal',
          errorCode: 'UNPROCESSABLE',
        });
      }

      // Clamp: never push past the target.
      const headroom = before.targetAmount.minus(before.currentAmount);
      const applied = headroom.lessThanOrEqualTo(0)
        ? new Prisma.Decimal(0)
        : Prisma.Decimal.min(requested, headroom);

      if (applied.isZero()) {
        // Goal is already full — record idempotency anyway so a retry stays
        // a no-op, but don't bump the counter.
        if (opts.idempotencyKey) {
          await this.idempotency.record({
            userId,
            scope: 'saving:contribute',
            key: opts.idempotencyKey,
            entityType: FinanceEntityType.SAVING_CONTRIBUTION,
            entityId: id,
            tx,
          });
        }
        return { goal: before, appliedAmount: '0.00' };
      }

      const result = await tx.savingGoal.updateMany({
        where: {
          id,
          userId,
          status: { not: SavingGoalStatus.CANCELLED },
          currentAmount: before.currentAmount,
        },
        data: { currentAmount: { increment: applied } },
      });
      if (result.count === 0) {
        throw new BadRequestException({
          message: 'Concurrent contribution detected; please retry',
          errorCode: 'CONCURRENT_WRITE',
        });
      }

      const after = await tx.savingGoal.findUnique({ where: { id } });
      if (!after) {
        throw new NotFoundException({
          message: 'Saving goal vanished mid-write',
          errorCode: 'NOT_FOUND',
        });
      }
      const reached = after.currentAmount.greaterThanOrEqualTo(after.targetAmount);
      const finalRow = reached && after.status !== SavingGoalStatus.COMPLETED
        ? await tx.savingGoal.update({
            where: { id },
            data: { status: SavingGoalStatus.COMPLETED },
          })
        : after;

      await this.audit.record({
        tx,
        userId,
        entityType: FinanceEntityType.SAVING_CONTRIBUTION,
        entityId: id,
        action: FinanceAction.CONTRIBUTE,
        before: snapshot(before),
        after: snapshot(finalRow),
      });
      if (opts.idempotencyKey) {
        await this.idempotency.record({
          userId,
          scope: 'saving:contribute',
          key: opts.idempotencyKey,
          entityType: FinanceEntityType.SAVING_CONTRIBUTION,
          entityId: id,
          tx,
        });
      }
      return { goal: finalRow, appliedAmount: applied.toFixed(2) };
    });
  }

  async delete(userId: string, id: string) {
    const before = await this.getById(userId, id);
    await this.prisma.savingGoal.delete({ where: { id } });
    await this.audit.record({
      userId,
      entityType: FinanceEntityType.SAVING_GOAL,
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
  targetAmount: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
  currency: string;
  status: SavingGoalStatus;
  priority: Priority;
  targetDate: Date | null;
}): Record<string, unknown> {
  return {
    id: row.id,
    targetAmount: row.targetAmount,
    currentAmount: row.currentAmount,
    currency: row.currency,
    status: row.status,
    priority: row.priority,
    targetDate: row.targetDate,
  };
}
