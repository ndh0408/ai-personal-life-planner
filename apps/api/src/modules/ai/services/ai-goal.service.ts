import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Locale } from '../prompts/system';

export type GoalSummary = {
  id: string;
  title: string;
  category: string;
  progressPercent: number | null;
  stalled: boolean;
};

/**
 * Personal-goals helper for AI services.
 *
 * Provides a small shared surface so planners/reviews/chat can:
 *   - pull the caller's active goals at a glance,
 *   - compute progress % consistently,
 *   - detect "stalled" goals (deadline within 30 days + <40% progress).
 *
 * No AI calls here — this is pure aggregation used as prompt context input.
 */
@Injectable()
export class AiGoalService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveForUser(userId: string, limit = 10): Promise<GoalSummary[]> {
    const goals = await this.prisma.personalGoal.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
      take: limit,
    });

    const now = Date.now();
    return goals.map((g) => {
      const progressPercent =
        g.targetValue && g.targetValue > 0 && g.currentValue !== null
          ? Math.round((g.currentValue / g.targetValue) * 100)
          : null;
      const daysLeft = g.deadline
        ? Math.round((g.deadline.getTime() - now) / 86_400_000)
        : null;
      const stalled =
        progressPercent !== null &&
        progressPercent < 40 &&
        daysLeft !== null &&
        daysLeft > 0 &&
        daysLeft < 30;
      return {
        id: g.id,
        title: g.title,
        category: g.category,
        progressPercent,
        stalled,
      };
    });
  }

  nudgeFallback(locale: Locale): string {
    return locale === 'en'
      ? 'One small step today beats waiting for the perfect moment. Pick one goal and move it forward by 1%.'
      : 'Một bước nhỏ hôm nay còn hơn chờ đợi thời điểm hoàn hảo. Chọn một mục tiêu và tiến thêm 1% là đủ.';
  }
}
