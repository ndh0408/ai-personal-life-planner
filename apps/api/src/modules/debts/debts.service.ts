import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DebtStatus, DebtType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateDebtInput = {
  type: DebtType;
  personName?: string;
  title: string;
  totalAmount: number;
  paidAmount?: number;
  dueDate?: string; // YYYY-MM-DD
  note?: string;
};

export type UpdateDebtInput = Partial<CreateDebtInput> & { status?: DebtStatus };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.debt.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.debt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Debt not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateDebtInput) {
    if (input.totalAmount <= 0) {
      throw new BadRequestException({ message: 'totalAmount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const paid = input.paidAmount ?? 0;
    if (paid < 0 || paid > input.totalAmount) {
      throw new BadRequestException({
        message: 'paidAmount must be in [0, totalAmount]',
        errorCode: 'UNPROCESSABLE',
      });
    }
    return this.prisma.debt.create({
      data: {
        userId,
        type: input.type,
        personName: input.personName ?? null,
        title: input.title,
        totalAmount: input.totalAmount,
        paidAmount: paid,
        dueDate: input.dueDate ? toDate(input.dueDate) : null,
        note: input.note ?? null,
        status: paid >= input.totalAmount ? DebtStatus.PAID : DebtStatus.ACTIVE,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateDebtInput) {
    await this.getById(userId, id);
    const data: Prisma.DebtUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.personName !== undefined) data.personName = input.personName;
    if (input.title !== undefined) data.title = input.title;
    if (input.totalAmount !== undefined) data.totalAmount = input.totalAmount;
    if (input.paidAmount !== undefined) data.paidAmount = input.paidAmount;
    if (input.status !== undefined) data.status = input.status;
    if (input.note !== undefined) data.note = input.note;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? toDate(input.dueDate) : null;
    return this.prisma.debt.update({ where: { id }, data });
  }

  /**
   * PATCH /debts/:id/payment — record a payment against the debt.
   *   amount: positive number to add to paidAmount.
   *   markPaid: optional short-circuit to flag the debt PAID regardless of math.
   * Auto-flips status to PAID once paidAmount >= totalAmount.
   */
  async addPayment(userId: string, id: string, amount: number, markPaid?: boolean) {
    if (amount <= 0) {
      throw new BadRequestException({ message: 'amount must be > 0', errorCode: 'UNPROCESSABLE' });
    }
    const debt = await this.getById(userId, id);
    if (debt.status === DebtStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Cannot pay a cancelled debt',
        errorCode: 'UNPROCESSABLE',
      });
    }
    const newPaid = Number(debt.paidAmount) + amount;
    const total = Number(debt.totalAmount);
    if (newPaid > total + 0.001) {
      throw new BadRequestException({
        message: 'Payment exceeds remaining balance',
        errorCode: 'UNPROCESSABLE',
      });
    }
    const reached = newPaid >= total - 0.001;
    return this.prisma.debt.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        status: markPaid || reached ? DebtStatus.PAID : DebtStatus.ACTIVE,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.debt.delete({ where: { id } });
  }
}
