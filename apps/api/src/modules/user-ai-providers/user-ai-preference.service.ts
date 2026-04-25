import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserAiPreference, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateUserAiPreferenceInput } from '@planner/shared';

@Injectable()
export class UserAiPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserAiPreference | null> {
    return this.prisma.userAiPreference.findUnique({ where: { userId } });
  }

  async update(userId: string, input: UpdateUserAiPreferenceInput): Promise<UserAiPreference> {
    if (input.defaultProviderId) {
      const exists = await this.prisma.userAiProvider.findFirst({
        where: { id: input.defaultProviderId, userId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException({
          message: 'defaultProviderId not found',
          errorCode: 'NOT_FOUND',
        });
      }
    }

    if (input.useOwnApiKey === true) {
      const anyProvider = await this.prisma.userAiProvider.findFirst({
        where: { userId, isActive: true },
        select: { id: true },
      });
      if (!anyProvider) {
        throw new BadRequestException({
          message:
            'Cannot enable useOwnApiKey without at least one active provider',
          errorCode: 'AI_PROVIDER_NOT_CONFIGURED',
        });
      }
    }

    const data: Prisma.UserAiPreferenceUpdateInput = {};
    if (input.useOwnApiKey !== undefined) data.useOwnApiKey = input.useOwnApiKey;
    if (input.fallbackToGlobalProvider !== undefined) {
      data.fallbackToGlobalProvider = input.fallbackToGlobalProvider;
    }
    if (input.defaultProviderId !== undefined) {
      data.defaultProviderId = input.defaultProviderId;
    }

    return this.prisma.userAiPreference.upsert({
      where: { userId },
      create: {
        userId,
        useOwnApiKey: input.useOwnApiKey ?? false,
        fallbackToGlobalProvider: input.fallbackToGlobalProvider ?? true,
        defaultProviderId: input.defaultProviderId ?? null,
      },
      update: data,
    });
  }
}
