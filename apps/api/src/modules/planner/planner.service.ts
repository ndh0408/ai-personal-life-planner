import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DailyPlanItemStatus,
  DailyPlanItemType,
  type DailyPlan,
  type DailyPlanItem,
} from '@prisma/client';
import type {
  DailyPlanItemPublic,
  DailyPlanPublic,
  GenerateDailyPlanResponse,
} from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor } from '../../common/datetime/range';
import { generatePlanItems, type DraftItem } from './planner.generator';
import { PlannerAiGenerator } from './planner.ai-generator';
import { EventLogService } from '../intelligence/event-log.service';

@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: PlannerAiGenerator,
    private readonly events: EventLogService,
  ) {}

  async getToday(userId: string): Promise<DailyPlanPublic | null> {
    const today = startOfTodayLocal();
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return plan ? toPlan(plan, plan.items) : null;
  }

  async generateToday(userId: string): Promise<GenerateDailyPlanResponse> {
    const today = startOfTodayLocal();

    // Try AI first; if it returns null (no key, privacy off, network/parse fail),
    // fall back to the rule generator.
    const aiResult = await this.ai.generate(userId);
    let drafts: DraftItem[];
    let summary: string | null;
    let aiUsed: boolean;
    if (aiResult && aiResult.items.length > 0) {
      drafts = aiResult.items;
      summary = aiResult.summary;
      aiUsed = true;
    } else {
      const range = rangeFor('today');
      const [profile, tasks] = await Promise.all([
        this.prisma.userProfile.findUnique({ where: { userId } }),
        this.prisma.task.findMany({
          where: {
            userId,
            deletedAt: null,
            status: { in: ['TODO', 'IN_PROGRESS'] },
            OR: [{ dueAt: null }, { dueAt: { gte: range.start, lt: range.end } }],
          },
          take: 30,
        }),
      ]);
      drafts = generatePlanItems(tasks, profile, new Date());
      summary = ruleSummary(drafts, profile, tasks.length);
      aiUsed = false;
    }

    // Upsert the plan, then replace its items (simplest "regenerate" semantics).
    const plan = await this.prisma.dailyPlan.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, aiGenerated: aiUsed, summary },
      update: { aiGenerated: aiUsed, summary, updatedAt: new Date() },
    });

    await this.prisma.$transaction([
      this.prisma.dailyPlanItem.deleteMany({ where: { dailyPlanId: plan.id } }),
      this.prisma.dailyPlanItem.createMany({
        data: drafts.map((d) => ({
          userId,
          dailyPlanId: plan.id,
          title: d.title,
          type: d.type as DailyPlanItemType,
          startAt: d.startAt,
          endAt: d.endAt,
          sortOrder: d.sortOrder,
          status: DailyPlanItemStatus.PENDING,
        })),
      }),
    ]);

    const reloaded = await this.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return { plan: toPlan(reloaded, reloaded.items), generated: drafts.length };
  }

  /**
   * Update an item's title / start / end. Records a PLAN_ITEM_EDITED event so
   * the AI knows the user disagreed with its choice — future plans should
   * lean toward the user's edits.
   */
  async updateItem(
    userId: string,
    itemId: string,
    input: { title?: string; startAtIso?: string | null; endAtIso?: string | null },
  ): Promise<DailyPlanItemPublic> {
    const item = await this.prisma.dailyPlanItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Mục không tồn tại.' } });
    }
    if (item.userId !== userId) {
      throw new ForbiddenException({ error: { code: 'FORBIDDEN', message: 'Không có quyền với mục này.' } });
    }
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.startAtIso !== undefined) {
      data.startAt = input.startAtIso ? new Date(input.startAtIso) : null;
    }
    if (input.endAtIso !== undefined) {
      data.endAt = input.endAtIso ? new Date(input.endAtIso) : null;
    }
    const updated = await this.prisma.dailyPlanItem.update({ where: { id: itemId }, data });
    await this.events.log(userId, 'PLAN_ITEM_EDITED', updated.title, {
      id: itemId,
      titleChanged: input.title !== undefined,
      timeChanged: input.startAtIso !== undefined || input.endAtIso !== undefined,
    });
    return toItem(updated);
  }

  async updateItemStatus(
    userId: string,
    itemId: string,
    status: 'PENDING' | 'COMPLETED' | 'SKIPPED',
  ): Promise<DailyPlanItemPublic> {
    const item = await this.prisma.dailyPlanItem.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Mục không tồn tại.' },
      });
    }
    if (item.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Không có quyền với mục này.' },
      });
    }
    const updated = await this.prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: { status: status as DailyPlanItemStatus },
    });
    if (status === 'COMPLETED') {
      await this.events.log(userId, 'PLAN_ITEM_DONE', updated.title, { id: itemId });
    } else if (status === 'SKIPPED') {
      await this.events.log(userId, 'PLAN_ITEM_SKIP', updated.title, { id: itemId });
    }
    return toItem(updated);
  }
}

function startOfTodayLocal(): Date {
  const r = rangeFor('today');
  return r.start;
}

/**
 * Best-effort fallback summary when the AI is unavailable. Threads the user's
 * preferredName + open-task count into one empathetic sentence; intentionally
 * lightweight so it doesn't masquerade as the real AI line.
 */
function ruleSummary(
  drafts: DraftItem[],
  profile: { preferredName: string | null } | null,
  totalOpenTasks: number,
): string {
  const taskCount = drafts.filter((d) => d.type === 'TASK').length;
  const name = profile?.preferredName?.trim();
  const greet = name ? `${name} ơi, ` : '';
  if (totalOpenTasks === 0) {
    return `${greet}hôm nay không có việc tồn — dành thời gian phục hồi và làm điều mình thích.`;
  }
  if (taskCount <= 1) {
    return `${greet}một việc chính trong ngày, phần còn lại là ăn uống + nghỉ. Đi từ tốn nhé.`;
  }
  return `${greet}${taskCount} việc xếp trong ngày — ưu tiên việc quan trọng vào lúc tỉnh táo nhất.`;
}

function toItem(i: DailyPlanItem): DailyPlanItemPublic {
  return {
    id: i.id,
    title: i.title,
    startAt: i.startAt ? i.startAt.toISOString() : null,
    endAt: i.endAt ? i.endAt.toISOString() : null,
    type: i.type,
    status: i.status,
    sortOrder: i.sortOrder,
  };
}

function toPlan(p: DailyPlan, items: DailyPlanItem[]): DailyPlanPublic {
  return {
    id: p.id,
    date: p.date.toISOString(),
    summary: p.summary,
    aiGenerated: p.aiGenerated,
    items: items.map(toItem),
  };
}
