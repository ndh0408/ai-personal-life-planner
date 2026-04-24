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
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getById(userId: string, id: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet) throw new NotFoundException({ message: 'Wallet not found', errorCode: 'NOT_FOUND' });
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
    if (input.balance !== undefined) data.balance = input.balance;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.wallet.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    // Income/Expense rows keep their history via ON DELETE SET NULL on walletId.
    await this.prisma.wallet.delete({ where: { id } });
  }
}
