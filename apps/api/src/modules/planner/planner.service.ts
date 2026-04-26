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
import { generatePlanItems } from './planner.generator';

@Injectable()
export class PlannerService {
  constructor(private readonly prisma: PrismaService) {}

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
    const drafts = generatePlanItems(tasks, profile, new Date());

    // Upsert the plan, then replace its items (simplest "regenerate" semantics).
    const plan = await this.prisma.dailyPlan.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, aiGenerated: false, summary: null },
      update: { aiGenerated: false, updatedAt: new Date() },
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
    return toItem(updated);
  }
}

function startOfTodayLocal(): Date {
  const r = rangeFor('today');
  return r.start;
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
