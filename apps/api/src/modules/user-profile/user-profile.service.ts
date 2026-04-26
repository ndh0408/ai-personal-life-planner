import { Injectable } from '@nestjs/common';
import type { UpdateProfileRequest, UserProfilePublic } from '@lifeos/shared';
import type { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string): Promise<UserProfilePublic> {
    const row = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return toPublic(row);
  }

  async update(userId: string, input: UpdateProfileRequest): Promise<UserProfilePublic> {
    // Build the update data only from explicitly-provided fields so callers
    // can PATCH a single value without nuking the rest.
    const data: Prisma.UserProfileUpdateInput = {};
    if (input.preferredName !== undefined) data.preferredName = input.preferredName;
    if (input.locale !== undefined) data.locale = input.locale;
    if (input.mainGoals !== undefined) data.mainGoals = input.mainGoals;
    if (input.usualWakeTime !== undefined) data.usualWakeTime = input.usualWakeTime;
    if (input.usualSleepTime !== undefined) data.usualSleepTime = input.usualSleepTime;
    if (input.completeOnboarding === true) data.onboardingCompletedAt = new Date();

    // Same upsert pattern: a fresh user might not have a profile row yet
    // (the auth.service auto-creates one but tests / migrations may not).
    const create: Prisma.UserProfileCreateInput = {
      user: { connect: { id: userId } },
      preferredName: input.preferredName ?? null,
      locale: input.locale ?? 'vi',
      mainGoals: input.mainGoals ?? [],
      usualWakeTime: input.usualWakeTime ?? null,
      usualSleepTime: input.usualSleepTime ?? null,
      onboardingCompletedAt: input.completeOnboarding ? new Date() : null,
    };

    const row = await this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create,
    });
    return toPublic(row);
  }
}

function toPublic(p: UserProfile): UserProfilePublic {
  return {
    preferredName: p.preferredName,
    // Prisma's Locale enum is structurally identical to the shared Zod enum
    // ('vi' | 'en'); cast to keep the wire-format-safe type at the boundary.
    locale: p.locale as 'vi' | 'en',
    timezone: p.timezone,
    currency: p.currency,
    mainGoals: Array.isArray(p.mainGoals) ? (p.mainGoals as string[]) : [],
    usualWakeTime: p.usualWakeTime,
    usualSleepTime: p.usualSleepTime,
    onboardingCompletedAt: p.onboardingCompletedAt
      ? p.onboardingCompletedAt.toISOString()
      : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}
