import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateScheduleItemInput,
  UpdateScheduleItemInput,
  PatchScheduleItemStatusInput,
  ReorderScheduleItemsInput,
} from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScheduleItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, scheduleId: string, input: CreateScheduleItemInput) {
    const schedule = await this.prisma.dailySchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.userId !== userId) throw new ForbiddenException();

    if (new Date(input.endTime) <= new Date(input.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }

    return this.prisma.scheduleItem.create({
      data: {
        scheduleId,
        userId,
        title: input.title,
        description: input.description ?? null,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        type: input.type,
        priority: input.priority ?? 'MEDIUM',
        reason: input.reason ?? null,
        sortOrder: input.sortOrder ?? 0,
        aiGenerated: input.aiGenerated ?? false,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateScheduleItemInput) {
    await this.assertOwn(userId, id);

    if (input.startTime && input.endTime && new Date(input.endTime) <= new Date(input.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const data: Prisma.ScheduleItemUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.startTime !== undefined) data.startTime = new Date(input.startTime);
    if (input.endTime !== undefined) data.endTime = new Date(input.endTime);
    if (input.type !== undefined) data.type = input.type;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.reason !== undefined) data.reason = input.reason;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.aiGenerated !== undefined) data.aiGenerated = input.aiGenerated;

    return this.prisma.scheduleItem.update({ where: { id }, data });
  }

  async patchStatus(userId: string, id: string, input: PatchScheduleItemStatusInput) {
    await this.assertOwn(userId, id);
    return this.prisma.scheduleItem.update({
      where: { id },
      data: { status: input.status },
    });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.scheduleItem.delete({ where: { id } });
  }

  async reorder(userId: string, input: ReorderScheduleItemsInput) {
    const schedule = await this.prisma.dailySchedule.findUnique({
      where: { id: input.scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (schedule.userId !== userId) throw new ForbiddenException();

    const ids = input.items.map((i) => i.id);
    const owned = await this.prisma.scheduleItem.findMany({
      where: { id: { in: ids }, scheduleId: input.scheduleId, userId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('All items must belong to the given schedule');
    }

    await this.prisma.$transaction(
      input.items.map((i) =>
        this.prisma.scheduleItem.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );

    return this.prisma.scheduleItem.findMany({
      where: { scheduleId: input.scheduleId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.scheduleItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Schedule item not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
