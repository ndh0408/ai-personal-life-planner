import { Injectable } from '@nestjs/common';
import { Prisma, UserProfile } from '@prisma/client';
import type { UpdateProfileInput } from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dateToHhmm, hhmmToDate } from '../../common/utils/time.util';

const TIME_FIELDS = [
  'workStartTime',
  'workEndTime',
  'usualWakeTime',
  'usualSleepTime',
] as const;

function serialize(profile: UserProfile) {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    occupation: profile.occupation,
    workStartTime: dateToHhmm(profile.workStartTime),
    workEndTime: dateToHhmm(profile.workEndTime),
    usualWakeTime: dateToHhmm(profile.usualWakeTime),
    usualSleepTime: dateToHhmm(profile.usualSleepTime),
    mainGoal: profile.mainGoal,
    activityLevel: profile.activityLevel,
    dietaryPreference: profile.dietaryPreference,
    healthNotes: profile.healthNotes,
    timezone: profile.timezone,
    locale: profile.locale,
    monthlySalary: profile.monthlySalary !== null ? Number(profile.monthlySalary) : null,
    salaryDay: profile.salaryDay,
    currency: profile.currency,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function buildData(input: UpdateProfileInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if ((TIME_FIELDS as readonly string[]).includes(key) && typeof value === 'string') {
      data[key] = hhmmToDate(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return { profile: null, exists: false as const };
    return { profile: serialize(profile), exists: true as const };
  }

  async upsert(userId: string, input: UpdateProfileInput): Promise<{ profile: ReturnType<typeof serialize>; created: boolean }> {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    const data = buildData(input);

    if (existing) {
      const updated = await this.prisma.userProfile.update({
        where: { userId },
        data: data as Prisma.UserProfileUncheckedUpdateInput,
      });
      return { profile: serialize(updated), created: false };
    }

    // Create — fullName is required by the schema, default to email-prefix-style
    const fullName = (data.fullName as string | undefined) ?? 'User';
    const created = await this.prisma.userProfile.create({
      data: {
        ...(data as Prisma.UserProfileUncheckedCreateInput),
        fullName,
        userId,
      },
    });
    return { profile: serialize(created), created: true };
  }
}
