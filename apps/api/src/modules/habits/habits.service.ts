import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateHabitInput,
  UpdateHabitInput,
  LogHabitInput,
  HabitLogsQuery,
} from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly } from '../../common/utils/time.util';

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.habit.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  create(userId: string, input: CreateHabitInput) {
    return this.prisma.habit.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
        frequency: input.frequency,
        targetCount: input.targetCount,
        color: input.color ?? null,
        icon: input.icon ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateHabitInput) {
    await this.assertOwn(userId, id);
    const data: Prisma.HabitUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.targetCount !== undefined) data.targetCount = input.targetCount;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.prisma.habit.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.habit.delete({ where: { id } });
  }

  async log(userId: string, habitId: string, input: LogHabitInput) {
    await this.assertOwn(userId, habitId);
    const date = dateOnly(input.date ?? new Date().toISOString().slice(0, 10));

    return this.prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      create: {
        habitId,
        userId,
        date,
        completed: input.completed,
        count: input.count,
        note: input.note ?? null,
      },
      update: {
        completed: input.completed,
        count: input.count,
        note: input.note ?? null,
      },
    });
  }

  listLogs(userId: string, query: HabitLogsQuery) {
    const where: Prisma.HabitLogWhereInput = { userId };
    if (query.habitId) where.habitId = query.habitId;
    if (query.date) where.date = dateOnly(query.date);

    return this.prisma.habitLog.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { habit: { select: { id: true, name: true, color: true, icon: true } } },
    });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.habit.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Habit not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
