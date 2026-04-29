/**
 * Mirror of FinanceService for incomes — same shape, same idempotency, but
 * wallet balance moves UP. Soft delete reverses (decrements) the wallet.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Income } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface IncomeRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  incomeDate: string;
  walletId: string;
  note: string | null;
  createdAt: string;
}

export interface IncomeListResponse {
  range: RangeName | null;
  total: number;
  totalAmount: number;
  rows: IncomeRow[];
}

export interface CreateIncomeInput {
  title: string;
  amount: number;
  category: string;
  incomeDateIso: string;
  walletId?: string;
  note?: string | null;
  idempotencyKey?: string;
}

export interface UpdateIncomeInput {
  title?: string;
  amount?: number;
  category?: string;
  incomeDateIso?: string;
  note?: string | null;
}

@Injectable()
export class IncomesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, range: RangeName | null): Promise<IncomeListResponse> {
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (range) {
      const { start, end } = rangeFor(range);
      where.incomeDate = { gte: start, lt: end };
    }
    const rows = await this.prisma.income.findMany({
      where,
      orderBy: { incomeDate: 'desc' },
      take: 200,
    });
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return { range, total: rows.length, totalAmount, rows: rows.map(toRow) };
  }

  async create(userId: string, input: CreateIncomeInput): Promise<IncomeRow> {
    const wallet = await this.resolveWallet(userId, input.walletId);

    if (input.idempotencyKey) {
      const existing = await this.prisma.income.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return toRow(existing);
    }

    const amount = new Prisma.Decimal(input.amount);
    const [row] = await this.prisma.$transaction([
      this.prisma.income.create({
        data: {
          userId,
          walletId: wallet.id,
          title: input.title.trim(),
          amount,
          category: input.category,
          incomeDate: new Date(input.incomeDateIso),
          note: input.note?.trim() || null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      }),
    ]);
    return toRow(row);
  }

  async update(userId: string, id: string, input: UpdateIncomeInput): Promise<IncomeRow> {
    const existing = await this.assertOwn(userId, id);

    const newAmount =
      input.amount !== undefined ? new Prisma.Decimal(input.amount) : null;
    const data: Prisma.IncomeUpdateInput = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.category !== undefined) data.category = input.category;
    if (input.incomeDateIso !== undefined) data.incomeDate = new Date(input.incomeDateIso);
    if (input.note !== undefined) data.note = input.note?.trim() || null;
    if (newAmount !== null) data.amount = newAmount;

    if (newAmount !== null && !newAmount.equals(existing.amount)) {
      // Wallet adjusts by the delta — positive delta = received more, increment.
      const delta = newAmount.minus(existing.amount);
      const [row] = await this.prisma.$transaction([
        this.prisma.income.update({ where: { id }, data }),
        this.prisma.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: delta } },
        }),
      ]);
      return toRow(row);
    }

    const row = await this.prisma.income.update({ where: { id }, data });
    return toRow(row);
  }

  async softDelete(userId: string, id: string): Promise<{ id: string }> {
    const existing = await this.assertOwn(userId, id);
    // Soft delete + remove the income from the wallet (mirror of expense refund).
    await this.prisma.$transaction([
      this.prisma.income.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.wallet.update({
        where: { id: existing.walletId },
        data: { balance: { decrement: existing.amount } },
      }),
    ]);
    return { id };
  }

  private async assertOwn(userId: string, id: string): Promise<Income> {
    const e = await this.prisma.income.findUnique({ where: { id } });
    if (!e || e.deletedAt) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Khoản thu không tồn tại.' },
      });
    }
    if (e.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Không có quyền với khoản thu này.' },
      });
    }
    return e;
  }

  private async resolveWallet(userId: string, walletId?: string) {
    if (walletId) {
      const w = await this.prisma.wallet.findUnique({ where: { id: walletId } });
      if (!w || w.deletedAt) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Ví không tồn tại.' },
        });
      }
      if (w.userId !== userId) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Không có quyền với ví này.' },
        });
      }
      return w;
    }
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, deletedAt: null, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.wallet.create({
      data: { userId, name: 'Ví chính', isDefault: true, currency: 'VND' },
    });
  }
}

function toRow(i: Income): IncomeRow {
  return {
    id: i.id,
    title: i.title,
    amount: Number(i.amount),
    currency: 'VND',
    category: i.category ?? 'other',
    incomeDate: i.incomeDate.toISOString(),
    walletId: i.walletId,
    note: i.note,
    createdAt: i.createdAt.toISOString(),
  };
}
