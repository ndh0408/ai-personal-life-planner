import { Injectable } from '@nestjs/common';
import type { Prisma, UserPattern, UserPatternType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Derives + persists a tiny set of personal patterns that the rule engine
 * needs as baselines (e.g. "what's this user's usual sleep time?"). Rule
 * engine then compares the live signal against these baselines.
 *
 * v1.2 derivation is intentionally simple — UserProfile fields override
 * historical averages when present (the user already configured them at
 * onboarding). v1.3 will run a nightly batch that recomputes from logs.
 */
@Injectable()
export class UserPatternService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string): Promise<UserPattern[]> {
    return this.prisma.userPattern.findMany({ where: { userId } });
  }

  /**
   * Refresh + return baseline patterns for the given user. Pure read where
   * possible; only writes when value or confidence changed.
   */
  async refresh(userId: string): Promise<UserPattern[]> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { usualSleepTime: true, usualWakeTime: true },
    });

    const updates: Array<{
      patternType: UserPatternType;
      value: Prisma.InputJsonValue;
      confidence: number;
    }> = [];

    if (profile?.usualSleepTime) {
      const t = profile.usualSleepTime as unknown as Date;
      updates.push({
        patternType: 'USUAL_SLEEP_TIME',
        value: { hour: t.getUTCHours(), minute: t.getUTCMinutes() },
        confidence: 0.9,
      });
    }
    if (profile?.usualWakeTime) {
      const t = profile.usualWakeTime as unknown as Date;
      updates.push({
        patternType: 'USUAL_WAKE_TIME',
        value: { hour: t.getUTCHours(), minute: t.getUTCMinutes() },
        confidence: 0.9,
      });
    }

    // Static defaults for meal times — overridden when the user logs
    // enough rows to derive their own. Confidence 0.4 = "weak baseline".
    const mealDefaults: Array<[UserPatternType, { hour: number; minute: number }]> = [
      ['USUAL_MEAL_TIME_BREAKFAST', { hour: 7, minute: 30 }],
      ['USUAL_MEAL_TIME_LUNCH', { hour: 12, minute: 0 }],
      ['USUAL_MEAL_TIME_DINNER', { hour: 19, minute: 0 }],
    ];
    for (const [pt, value] of mealDefaults) {
      updates.push({ patternType: pt, value, confidence: 0.4 });
    }

    // Average daily expense over last 30 days — used by EXPENSE_VELOCITY
    // signal. Computed lazily, written only if non-null.
    const since = new Date(Date.now() - 30 * 86_400_000);
    const expenseAgg = await this.prisma.expense.aggregate({
      where: { userId, expenseDate: { gte: since } },
      _avg: { amount: true },
      _count: { _all: true },
    });
    if (expenseAgg._count._all > 0 && expenseAgg._avg.amount) {
      updates.push({
        patternType: 'AVG_DAILY_EXPENSE',
        value: { amount: Number(expenseAgg._avg.amount) },
        confidence: Math.min(1, expenseAgg._count._all / 30),
      });
    }

    // Upsert all patterns in parallel.
    const now = new Date();
    await Promise.all(
      updates.map((u) =>
        this.prisma.userPattern.upsert({
          where: { userId_patternType: { userId, patternType: u.patternType } },
          create: { userId, ...u, lastObservedAt: now },
          update: { value: u.value, confidence: u.confidence, lastObservedAt: now },
        }),
      ),
    );

    return this.list(userId);
  }
}
