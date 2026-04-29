import { Injectable } from '@nestjs/common';
import type { UpdateProfileRequest, UserProfilePublic, WorkPattern } from '@lifeos/shared';
import { Prisma, type UserProfile } from '@prisma/client';
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
    if (input.dislikes !== undefined) data.dislikes = input.dislikes;
    if (input.allergies !== undefined) data.allergies = input.allergies;
    if (input.monthlyGoal !== undefined) data.monthlyGoal = input.monthlyGoal;
    if (input.workPattern !== undefined) data.workPattern = input.workPattern;
    if (input.budgetMonthly !== undefined) {
      data.budgetMonthly =
        input.budgetMonthly === null ? null : new Prisma.Decimal(input.budgetMonthly);
    }
    if (input.completeOnboarding === true) data.onboardingCompletedAt = new Date();

    const create: Prisma.UserProfileCreateInput = {
      user: { connect: { id: userId } },
      preferredName: input.preferredName ?? null,
      locale: input.locale ?? 'vi',
      mainGoals: input.mainGoals ?? [],
      usualWakeTime: input.usualWakeTime ?? null,
      usualSleepTime: input.usualSleepTime ?? null,
      dislikes: input.dislikes ?? [],
      allergies: input.allergies ?? [],
      monthlyGoal: input.monthlyGoal ?? null,
      workPattern: input.workPattern ?? null,
      budgetMonthly:
        input.budgetMonthly == null ? null : new Prisma.Decimal(input.budgetMonthly),
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
    locale: p.locale as 'vi' | 'en',
    timezone: p.timezone,
    currency: p.currency,
    mainGoals: Array.isArray(p.mainGoals) ? (p.mainGoals as string[]) : [],
    usualWakeTime: p.usualWakeTime,
    usualSleepTime: p.usualSleepTime,
    dislikes: Array.isArray(p.dislikes) ? (p.dislikes as string[]) : [],
    allergies: Array.isArray(p.allergies) ? (p.allergies as string[]) : [],
    monthlyGoal: p.monthlyGoal,
    workPattern: (p.workPattern as WorkPattern | null) ?? null,
    budgetMonthly: p.budgetMonthly == null ? null : Number(p.budgetMonthly),
    onboardingCompletedAt: p.onboardingCompletedAt
      ? p.onboardingCompletedAt.toISOString()
      : null,
    updatedAt: p.updatedAt.toISOString(),
  };
}
