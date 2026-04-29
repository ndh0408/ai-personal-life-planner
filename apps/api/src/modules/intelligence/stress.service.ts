/**
 * Stress detection (round 38).
 *
 * Combines three signals into a 0..1 stress score:
 *   - Sleep deficit: < 6h average across the last 3 nights → +0.4
 *   - Task skip rate: skipped or overdue ≥ 30% of last 14 days' tasks → +0.3
 *   - Heart rate elevation: HeartRateSample avg ≥ 1σ above the user's
 *     baseline avg over 14 days → +0.3
 *
 * The score is the sum of triggered components, clamped to [0,1].
 *
 * Output also includes the **reasons** array so the assistant /
 * "Why this?" UI can explain the score; never surfacing a number
 * without context. UserContextService injects the score (when above
 * 0.4) into the snapshot under `stress`.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface StressResult {
  /** 0..1; higher = more elevated stress signal. */
  score: number;
  /** Up to three short reason labels for the UI. */
  reasons: string[];
  /** Components that fired so the API consumer can score finer-grained. */
  components: {
    sleepDeficit: boolean;
    taskBacklog: boolean;
    elevatedHr: boolean;
  };
}

const SHORT_SLEEP_HOURS = 6;
const TASK_BACKLOG_RATIO = 0.3;
const HR_BASELINE_DAYS = 14;
const HR_RECENT_DAYS = 3;

@Injectable()
export class StressService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(userId: string, now = new Date()): Promise<StressResult> {
    const since3 = new Date(now.getTime() - 3 * 24 * 60 * 60_000);
    const since14 = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

    const [recentSleep, taskRows, hrRecent, hrBaseline] = await Promise.all([
      this.prisma.sleepLog.findMany({
        where: { userId, sleepAt: { gte: since3 } },
        select: { durationMinutes: true },
      }),
      this.prisma.task.findMany({
        where: { userId, deletedAt: null, createdAt: { gte: since14 } },
        select: { status: true, dueAt: true },
      }),
      this.prisma.heartRateSample.aggregate({
        where: { userId, bucketStart: { gte: new Date(now.getTime() - HR_RECENT_DAYS * 24 * 60 * 60_000) } },
        _avg: { avgBpm: true },
        _count: true,
      }),
      this.prisma.heartRateSample.aggregate({
        where: { userId, bucketStart: { gte: new Date(now.getTime() - HR_BASELINE_DAYS * 24 * 60 * 60_000) } },
        _avg: { avgBpm: true },
        _count: true,
      }),
    ]);

    const reasons: string[] = [];
    let score = 0;
    const components = { sleepDeficit: false, taskBacklog: false, elevatedHr: false };

    // Sleep deficit
    if (recentSleep.length >= 2) {
      const avg =
        recentSleep.reduce((s, r) => s + r.durationMinutes, 0) / recentSleep.length / 60;
      if (avg < SHORT_SLEEP_HOURS) {
        components.sleepDeficit = true;
        reasons.push(`Ngủ TB ${avg.toFixed(1)}h trong ${recentSleep.length} đêm`);
        score += 0.4;
      }
    }

    // Task backlog
    if (taskRows.length >= 5) {
      const skipped = taskRows.filter(
        (t) =>
          t.status === 'CANCELLED' ||
          (t.dueAt && t.dueAt < now && (t.status === 'TODO' || t.status === 'IN_PROGRESS')),
      ).length;
      const ratio = skipped / taskRows.length;
      if (ratio >= TASK_BACKLOG_RATIO) {
        components.taskBacklog = true;
        reasons.push(`${Math.round(ratio * 100)}% việc bị bỏ/quá hạn`);
        score += 0.3;
      }
    }

    // Elevated HR
    const recentAvg = hrRecent._avg.avgBpm;
    const baselineAvg = hrBaseline._avg.avgBpm;
    if (
      recentAvg != null &&
      baselineAvg != null &&
      hrRecent._count >= 12 &&
      hrBaseline._count >= 50
    ) {
      const diff = recentAvg - baselineAvg;
      if (diff >= 4) {
        components.elevatedHr = true;
        reasons.push(`Nhịp tim cao hơn ~${Math.round(diff)} bpm so với 14 ngày qua`);
        score += 0.3;
      }
    }

    return {
      score: Math.min(1, Number(score.toFixed(2))),
      reasons,
      components,
    };
  }
}
