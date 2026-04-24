import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Priority, SavingGoalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateSavingGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string; // YYYY-MM-DD
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
  constructor(private readonly prisma: PrismaService) {}

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
    if (input.targetAmount <= 0) {
      throw new BadRequestException({ message: 'targetAmount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const current = input.currentAmount ?? 0;
    if (current < 0) {
      throw new BadRequestException({
        message: 'currentAmount cannot be negative',
        errorCode: 'UNPROCESSABLE',
      });
    }
    return this.prisma.savingGoal.create({
      data: {
        userId,
        title: input.title,
        targetAmount: input.targetAmount,
        currentAmount: current,
        targetDate: input.targetDate ? toDate(input.targetDate) : null,
        priority: input.priority ?? Priority.MEDIUM,
        note: input.note ?? null,
        status:
          current >= input.targetAmount ? SavingGoalStatus.COMPLETED : SavingGoalStatus.ACTIVE,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateSavingGoalInput) {
    await this.getById(userId, id);
    const data: Prisma.SavingGoalUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.targetAmount !== undefined) data.targetAmount = input.targetAmount;
    if (input.currentAmount !== undefined) data.currentAmount = input.currentAmount;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;
    if (input.targetDate !== undefined) {
      data.targetDate = input.targetDate ? toDate(input.targetDate) : null;
    }
    return this.prisma.savingGoal.update({ where: { id }, data });
  }

  /**
   * PATCH /saving-goals/:id/contribute — add to currentAmount.
   * Auto-flips the goal to COMPLETED once currentAmount >= targetAmount.
   * Over-contributing (beyond target) is allowed but capped in display —
   * we keep the raw sum so users can see how far they went past the goal.
   */
  async contribute(userId: string, id: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const goal = await this.getById(userId, id);
    if (goal.status === SavingGoalStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot contribute to a cancelled goal',
        errorCode: 'UNPROCESSABLE',
      });
    }
    const newCurrent = Number(goal.currentAmount) + amount;
    const reached = newCurrent >= Number(goal.targetAmount);
    return this.prisma.savingGoal.update({
      where: { id },
      data: {
        currentAmount: newCurrent,
        status: reached ? SavingGoalStatus.COMPLETED : SavingGoalStatus.ACTIVE,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.savingGoal.delete({ where: { id } });
  }
}
