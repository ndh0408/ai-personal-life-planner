/**
 * Circadian intelligence (round 38).
 *
 * Detects the user's most-productive hours by combining two signals:
 *   1. Foreground app activity (EventLog rows under the activity-event
 *      kinds we already log — capture, screen-opened, assistant-sent).
 *   2. Task completion timestamps from the last 21 days.
 *
 * Strategy:
 *   - Bucket each signal into 24 hour-of-day slots (local time, in the
 *     user's profile.timezone).
 *   - Z-score-normalise each slot count, take the rolling 3-hour
 *     average, surface the top window of contiguous bins ≥ +0.7 σ.
 *
 * Output:
 *   {
 *     bestStartHour: 9,
 *     bestEndHour: 12,
 *     score: 0.83,        // 0..1, 1 = strong dominant pattern
 *     hourlyProductivity: [0.1, 0.0, ..., 1.0, 0.9, ..., 0.2]
 *   }
 *
 * Used by:
 *   - PlannerAiGenerator — anchors deep-work blocks inside best window.
 *   - LifeSnapshot — assistant references "your peak focus 09:00-12:00".
 *   - Adaptive Home (R37+) — task card promoted during best window.
 *
 * Caches in-memory for 30 min per user; recomputes lazily.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CircadianResult {
  /** 0-23, local hour of day. Best contiguous block start. */
  bestStartHour: number;
  /** 0-23 inclusive, local hour of day. */
  bestEndHour: number;
  /** 0..1 — confidence the pattern is real (vs noise). */
  score: number;
  /** 24-element array, normalised 0..1 productivity by hour-of-day. */
  hourlyProductivity: number[];
  /** Days of data we used to compute. */
  daysUsed: number;
}

const LOOKBACK_DAYS = 21;
const CACHE_TTL_MS = 30 * 60_000;

const ACTIVITY_KINDS = new Set([
  'CAPTURE_CONFIRMED',
  'SCREEN_OPENED',
  'QUICK_ACTION_USED',
  'ASSISTANT_MESSAGE_SENT',
  'TASK_CREATED',
]);

@Injectable()
export class CircadianService {
  private cache = new Map<string, { at: number; result: CircadianResult }>();

  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, now = new Date()): Promise<CircadianResult> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60_000);
    const [profile, events, completions] = await Promise.all([
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      this.prisma.eventLog.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { kind: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { userId, status: 'COMPLETED', updatedAt: { gte: since } },
        select: { updatedAt: true },
      }),
    ]);

    const tz = profile?.timezone ?? 'Asia/Ho_Chi_Minh';
    const buckets = new Array<number>(24).fill(0);

    for (const e of events) {
      if (!ACTIVITY_KINDS.has(e.kind)) continue;
      buckets[localHour(e.createdAt, tz)] += 1;
    }
    // Task completions count double — they're a stronger productivity signal
    // than just opening a screen.
    for (const t of completions) {
      buckets[localHour(t.updatedAt, tz)] += 2;
    }

    // Smoothed 3-hour rolling average (wraps midnight).
    const smoothed = buckets.map((_, i) => {
      const prev = buckets[(i + 23) % 24];
      const cur = buckets[i];
      const next = buckets[(i + 1) % 24];
      return (prev + cur + next) / 3;
    });

    const max = Math.max(...smoothed, 1);
    const hourlyProductivity = smoothed.map((v) => Number((v / max).toFixed(3)));

    // Pick the longest contiguous run where hourlyProductivity ≥ 0.7.
    let bestStart = 9;
    let bestEnd = 12;
    let bestLen = 0;
    let i = 0;
    while (i < 24) {
      if (hourlyProductivity[i] >= 0.7) {
        let j = i;
        while (j < 24 && hourlyProductivity[j] >= 0.7) j++;
        if (j - i > bestLen) {
          bestStart = i;
          bestEnd = j - 1;
          bestLen = j - i;
        }
        i = j;
      } else {
        i++;
      }
    }
    if (bestLen === 0) {
      // Not enough data → keep the harmless default 09:00-12:00.
      bestStart = 9;
      bestEnd = 12;
    }

    // Score = how concentrated the top is. Sum of the run / total signal.
    const total = smoothed.reduce((s, v) => s + v, 0) || 1;
    const inWindow = smoothed.slice(bestStart, bestEnd + 1).reduce((s, v) => s + v, 0);
    const concentration = inWindow / total;
    const score = Math.min(1, Math.max(0, concentration * 1.6)); // tune

    const result: CircadianResult = {
      bestStartHour: bestStart,
      bestEndHour: bestEnd,
      score: Number(score.toFixed(3)),
      hourlyProductivity,
      daysUsed: LOOKBACK_DAYS,
    };
    this.cache.set(userId, { at: Date.now(), result });
    return result;
  }
}

function localHour(d: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: tz,
    });
    const parts = fmt.formatToParts(d);
    const h = parts.find((p) => p.type === 'hour');
    return h ? Number(h.value) % 24 : d.getUTCHours();
  } catch {
    return d.getUTCHours();
  }
}
