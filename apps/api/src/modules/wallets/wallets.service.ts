import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, WalletType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateWalletInput = {
  name: string;
  type: WalletType;
  balance?: number;
  currency?: string;
};

export type UpdateWalletInput = Partial<CreateWalletInput> & { isActive?: boolean };

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getById(userId: string, id: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet || wallet.deletedAt) {
      throw new NotFoundException({ message: 'Wallet not found', errorCode: 'NOT_FOUND' });
    }
    if (wallet.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return wallet;
  }

  create(userId: string, input: CreateWalletInput) {
    return this.prisma.wallet.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        balance: input.balance ?? 0,
        currency: input.currency ?? 'VND',
      },
    });
  }

  async update(userId: string, id: string, input: UpdateWalletInput) {
    await this.getById(userId, id);
    const data: Prisma.WalletUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    // balance + currency are intentionally NOT settable here — see schema
    // comment in wallets.controller.ts.
    return this.prisma.wallet.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    // Soft delete (round 14): linked income/expense rows keep walletId so the
    // audit trail is intact; list/get queries hide the wallet via deletedAt.
    await this.prisma.wallet.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(userId: string, id: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet || wallet.userId !== userId) {
      throw new NotFoundException({ message: 'Wallet not found', errorCode: 'NOT_FOUND' });
    }
    if (!wallet.deletedAt) {
      throw new NotFoundException({ message: 'Wallet is not deleted', errorCode: 'NOT_FOUND' });
    }
    return this.prisma.wallet.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
