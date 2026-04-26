import { Injectable } from '@nestjs/common';
import { Prisma, type Wallet } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface WalletRow {
  id: string;
  name: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateWalletInput {
  name: string;
  initialBalance?: number;
  currency?: string;
  isDefault?: boolean;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<WalletRow[]> {
    const rows = await this.prisma.wallet.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toRow);
  }

  async getDefault(userId: string): Promise<WalletRow> {
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, deletedAt: null, isDefault: true },
    });
    if (existing) return toRow(existing);
    const created = await this.prisma.wallet.create({
      data: { userId, name: 'Ví chính', isDefault: true, currency: 'VND' },
    });
    return toRow(created);
  }

  async create(userId: string, input: CreateWalletInput): Promise<WalletRow> {
    const balance = new Prisma.Decimal(input.initialBalance ?? 0);
    const isDefault = input.isDefault ?? false;

    // If marking as default, demote any existing default wallet first.
    if (isDefault) {
      await this.prisma.wallet.updateMany({
        where: { userId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const row = await this.prisma.wallet.create({
      data: {
        userId,
        name: input.name.trim(),
        balance,
        currency: input.currency ?? 'VND',
        isDefault,
      },
    });
    return toRow(row);
  }
}

function toRow(w: Wallet): WalletRow {
  return {
    id: w.id,
    name: w.name,
    balance: Number(w.balance),
    currency: w.currency,
    isDefault: w.isDefault,
    createdAt: w.createdAt.toISOString(),
  };
}
