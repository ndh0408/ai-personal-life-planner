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

export type EventKind =
  | 'CAPTURE_PARSED'
  | 'CAPTURE_CONFIRMED'
  | 'CAPTURE_EDITED'
  | 'PLAN_ITEM_DONE'
  | 'PLAN_ITEM_SKIP'
  | 'PLAN_ITEM_EDITED'
  | 'INSIGHT_LIKED'
  | 'INSIGHT_DISMISSED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED';

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
      await this.prisma.eventLog.create({
        data: {
          userId,
          kind,
          summary: summary.slice(0, 280),
          payload: (payload ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(
        `EventLog write failed for userId=${userId} kind=${kind}: ${(e as Error).message}`,
      );
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
