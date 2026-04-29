/**
 * Energy-based planning hint (round 38).
 *
 * Returns a "today energy budget" the planner can read to decide whether
 * to schedule a heavy 90-min focus block or three short ones with rest.
 *
 * Inputs:
 *   - lastSleepMinutes (preferring DEVICE > MANUAL > INFERRED).
 *   - rolling 7-day sleep average.
 *   - last mood / energy log.
 *   - stress score (R38 StressService).
 *
 * Output:
 *   - level: 'low' | 'medium' | 'high'
 *   - recommendedFocusMinutes: 30 / 60 / 90
 *   - reasons: short labels matching what the user can see in the UI.
 *
 * Used by:
 *   - PlannerAiGenerator: passed in the snapshot input so the LLM
 *     produces shorter blocks on low-energy days.
 *   - LifeSnapshot: assistant can answer "How much can I do today?"
 *     without re-deriving anything.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StressService } from './stress.service';

export interface EnergyResult {
  level: 'low' | 'medium' | 'high';
  recommendedFocusMinutes: 30 | 60 | 90;
  reasons: string[];
  /** Raw signals so callers can re-render with their own copy. */
  signals: {
    lastSleepMinutes: number | null;
    sleepAvg7dMinutes: number | null;
    lastMood: string | null;
    lastEnergy: string | null;
    stressScore: number;
  };
}

@Injectable()
export class EnergyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stress: StressService,
  ) {}

  async assess(userId: string, now = new Date()): Promise<EnergyResult> {
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
    const [lastSleep, sleep7, lastMood, stress] = await Promise.all([
      this.prisma.sleepLog.findFirst({
        where: { userId },
        orderBy: { sleepAt: 'desc' },
        select: { durationMinutes: true },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, sleepAt: { gte: since7 } },
        select: { durationMinutes: true },
      }),
      this.prisma.moodLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        select: { mood: true, energy: true },
      }),
      this.stress.assess(userId, now),
    ]);

    const reasons: string[] = [];
    let score = 0; // 0..3 → maps to level

    const lastSleepMin = lastSleep?.durationMinutes ?? null;
    const avg7 =
      sleep7.length > 0
        ? sleep7.reduce((s, r) => s + r.durationMinutes, 0) / sleep7.length
        : null;

    if (lastSleepMin != null) {
      if (lastSleepMin >= 7 * 60) {
        score += 1;
        reasons.push(`Đêm qua ngủ ${(lastSleepMin / 60).toFixed(1)}h`);
      } else if (lastSleepMin < 5 * 60) {
        score -= 1;
        reasons.push(`Đêm qua chỉ ngủ ${(lastSleepMin / 60).toFixed(1)}h`);
      }
    }

    if (avg7 != null) {
      if (avg7 >= 7 * 60) score += 1;
      else if (avg7 < 6 * 60) {
        score -= 1;
        reasons.push(`TB 7 ngày: ${(avg7 / 60).toFixed(1)}h`);
      }
    }

    if (lastMood?.energy === 'HIGH') {
      score += 1;
      reasons.push('Energy gần nhất: cao');
    } else if (lastMood?.energy === 'LOW') {
      score -= 1;
      reasons.push('Energy gần nhất: thấp');
    }

    if (stress.score >= 0.6) {
      score -= 1;
      reasons.push('Stress đang cao');
    }

    let level: 'low' | 'medium' | 'high' = 'medium';
    let recommendedFocusMinutes: 30 | 60 | 90 = 60;
    if (score <= -1) {
      level = 'low';
      recommendedFocusMinutes = 30;
    } else if (score >= 2) {
      level = 'high';
      recommendedFocusMinutes = 90;
    }

    return {
      level,
      recommendedFocusMinutes,
      reasons: reasons.slice(0, 3),
      signals: {
        lastSleepMinutes: lastSleepMin,
        sleepAvg7dMinutes: avg7 == null ? null : Math.round(avg7),
        lastMood: lastMood?.mood ?? null,
        lastEnergy: lastMood?.energy ?? null,
        stressScore: stress.score,
      },
    };
  }
}
