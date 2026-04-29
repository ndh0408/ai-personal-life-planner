/**
 * Append-only stream of user actions. Every meaningful interaction lands here
 * so the AI (planner / assistant / insights) can read "what just happened"
 * from a single timeline instead of joining six entity tables.
 *
 * Writes are best-effort — failures don't propagate (the user-visible action
 * has already succeeded by the time we log).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Round 35: full LifeEvent taxonomy.
 *
 * Every meaningful user-facing action lands here. The AI layer (assistant /
 * planner / insights / behaviour) reads this stream as the source of truth
 * for "what just happened" — far cheaper and more semantic than joining
 * the entity tables.
 *
 * Conventions:
 *   - kinds use the legacy SCREAMING_SNAKE_CASE for stored history; the
 *     new shorthand aliases (snake_case) added in R35 are mapped here.
 *   - payloads are sanitised through `redactEventPayload()` so a stray
 *     password or token can't leak into the log.
 *   - summary is capped at 280 chars; payload at ~4 KB serialised.
 */
export type EventKind =
  // Capture lifecycle
  | 'CAPTURE_PARSED'
  | 'CAPTURE_CONFIRMED'
  | 'CAPTURE_EDITED'
  | 'CAPTURE_UNDONE'
  // Tasks
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_SKIPPED'
  | 'TASK_DELETED'
  | 'TASK_RESCHEDULED'
  // Finance
  | 'EXPENSE_CREATED'
  | 'INCOME_CREATED'
  // Health / lifestyle
  | 'MEAL_LOGGED'
  | 'SLEEP_LOGGED'
  | 'MOOD_LOGGED'
  // Plan
  | 'PLAN_GENERATED'
  | 'PLAN_ITEM_DONE'
  | 'PLAN_ITEM_SKIP'
  | 'PLAN_ITEM_EDITED'
  // Insights / nudges
  | 'INSIGHT_VIEWED'
  | 'INSIGHT_LIKED'
  | 'INSIGHT_DISMISSED'
  | 'INSIGHT_APPLIED'
  // Assistant
  | 'ASSISTANT_MESSAGE_SENT'
  | 'ASSISTANT_ACTION_TAPPED'
  // Mobile UX telemetry (privacy-respecting; no payload PII)
  | 'SCREEN_OPENED'
  | 'QUICK_ACTION_USED'
  // Sensor / device sync (R36)
  | 'DEVICE_DATA_SYNCED'
  | 'SLEEP_INFERRED';

/**
 * Strip secret-shaped keys + cap each value's length so a 200-token chat
 * snippet doesn't bloat the row. Recurses one level to catch nested
 * "auth.tokens" style payloads.
 */
const SECRET_KEY_RE = /password|secret|token|api[-_]?key|authorization|cookie|encrypted/i;
function redactEventPayload(input: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return { _truncated: true };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    if (typeof v === 'string') {
      out[k] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactEventPayload(v as Record<string, unknown>, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    kind: EventKind,
    summary: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const safe = payload ? redactEventPayload(payload) : {};
      await this.prisma.eventLog.create({
        data: {
          userId,
          kind,
          summary: summary.slice(0, 280),
          payload: safe as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(
        `EventLog write failed for userId=${userId} kind=${kind}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Bulk variant for sensors / batch jobs — single transaction, same
   * redaction. Returns the count actually persisted (0 on a hard fail).
   */
  async logBulk(
    userId: string,
    rows: Array<{ kind: EventKind; summary: string; payload?: Record<string, unknown> }>,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    try {
      const result = await this.prisma.eventLog.createMany({
        data: rows.map((r) => ({
          userId,
          kind: r.kind,
          summary: r.summary.slice(0, 280),
          payload: (r.payload ? redactEventPayload(r.payload) : {}) as Prisma.InputJsonValue,
        })),
      });
      return result.count;
    } catch (e) {
      this.logger.warn(`EventLog bulk write failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Most recent N events for a user, newest first. */
  async recent(userId: string, n = 30) {
    return this.prisma.eventLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
  }
}
