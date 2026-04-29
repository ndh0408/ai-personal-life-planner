/**
 * Sleep inference fallback (round 36).
 *
 * Many users won't grant Health Connect permission. For them, we infer
 * sleep windows from app foreground inactivity:
 *
 *   "If between 23:00 and 07:00 local time, no SCREEN_OPENED /
 *    QUICK_ACTION_USED / ASSISTANT_MESSAGE_SENT events landed for
 *    ≥ 6 hours continuous, treat that gap as a SleepLog with
 *    source=INFERRED."
 *
 * We're conservative on purpose:
 *   - Only fires once per night; if a manual or DEVICE row already
 *     covers the window, we skip.
 *   - Marks the row INFERRED so the UI can label it ("Phỏng đoán từ
 *     hoạt động ứng dụng") and the user can correct.
 *   - Min 6h gap → max 12h gap. Anything outside that range probably
 *     means the user just didn't open the app, not that they slept
 *     for 18 hours.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../intelligence/event-log.service';

const ACTIVITY_EVENTS = new Set([
  'SCREEN_OPENED',
  'QUICK_ACTION_USED',
  'CAPTURE_CONFIRMED',
  'ASSISTANT_MESSAGE_SENT',
]);

const MIN_GAP_MINUTES = 360; // 6h
const MAX_GAP_MINUTES = 720; // 12h
/** Local-time window where an inactivity gap counts as sleep. */
const NIGHT_START_HOUR = 22; // 22:00
const NIGHT_END_HOUR = 9;    // 09:00 next morning

@Injectable()
export class SleepInferenceService {
  private readonly logger = new Logger(SleepInferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventLogService,
  ) {}

  /**
   * Run the inference for one user. Idempotent — if a SleepLog already
   * covers the inferred window, we don't re-create.
   *
   * Returns the SleepLog id if a new row was created, null otherwise.
   */
  async inferForUser(userId: string, now: Date = new Date()): Promise<string | null> {
    const since = new Date(now.getTime() - 36 * 60 * 60_000);
    const eventRows = await this.prisma.eventLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { kind: true, createdAt: true },
    });
    const activity = eventRows.filter((e) => ACTIVITY_EVENTS.has(e.kind));
    if (activity.length < 2) return null; // not enough signal

    const gap = this.findLongestGap(activity);
    if (!gap) return null;
    const minutes = (gap.end.getTime() - gap.start.getTime()) / 60_000;
    if (minutes < MIN_GAP_MINUTES || minutes > MAX_GAP_MINUTES) return null;

    // Anchor on local hour-of-day. We treat the user's profile timezone
    // as authoritative; fall back to the server tz if unset.
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const tz = profile?.timezone ?? 'Asia/Ho_Chi_Minh';
    const startHour = this.localHour(gap.start, tz);
    const endHour = this.localHour(gap.end, tz);
    const startsInNight = startHour >= NIGHT_START_HOUR || startHour < NIGHT_END_HOUR;
    const endsInMorning = endHour <= NIGHT_END_HOUR + 2;
    if (!startsInNight || !endsInMorning) return null;

    // Skip if a SleepLog (manual / device) already overlaps.
    const overlap = await this.prisma.sleepLog.findFirst({
      where: {
        userId,
        sleepAt: { lt: gap.end },
        wakeAt: { gt: gap.start },
      },
    });
    if (overlap) return null;

    const created = await this.prisma.sleepLog.create({
      data: {
        userId,
        sleepAt: gap.start,
        wakeAt: gap.end,
        durationMinutes: Math.round(minutes),
        source: 'INFERRED',
        note: 'Phỏng đoán từ khoảng không hoạt động trong app',
      },
    });
    await this.events
      .log(userId, 'SLEEP_INFERRED', `Inferred sleep ${Math.round(minutes / 60)}h`, {
        sleepLogId: created.id,
        durationMinutes: Math.round(minutes),
        gapStart: gap.start.toISOString(),
        gapEnd: gap.end.toISOString(),
      })
      .catch(() => undefined);
    return created.id;
  }

  /** Run inference for everyone — used by the cron / SensorSyncJob. */
  async inferForAll(now: Date = new Date()): Promise<{ users: number; inserted: number }> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    let inserted = 0;
    for (const u of users) {
      try {
        const id = await this.inferForUser(u.id, now);
        if (id) inserted++;
      } catch (e) {
        this.logger.warn(`inference failed for ${u.id}: ${(e as Error).message}`);
      }
    }
    return { users: users.length, inserted };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private findLongestGap(
    activity: Array<{ createdAt: Date }>,
  ): { start: Date; end: Date } | null {
    if (activity.length < 2) return null;
    let bestStart: Date | null = null;
    let bestEnd: Date | null = null;
    let bestMs = 0;
    for (let i = 1; i < activity.length; i++) {
      const a = activity[i - 1].createdAt;
      const b = activity[i].createdAt;
      const ms = b.getTime() - a.getTime();
      if (ms > bestMs) {
        bestMs = ms;
        bestStart = a;
        bestEnd = b;
      }
    }
    return bestStart && bestEnd ? { start: bestStart, end: bestEnd } : null;
  }

  /**
   * Local hour-of-day for a UTC timestamp under the user's tz.
   * Uses Intl rather than Date math — saves a manual DST table.
   */
  private localHour(d: Date, tz: string): number {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
      const parts = fmt.formatToParts(d);
      const h = parts.find((p) => p.type === 'hour');
      return h ? Number(h.value) : d.getUTCHours();
    } catch {
      return d.getUTCHours();
    }
  }
}
