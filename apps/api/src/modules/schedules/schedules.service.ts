import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
} from '@planner/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly, hhmmToDate } from '../../common/utils/time.util';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  getByDate(userId: string, date: string) {
    return this.prisma.dailySchedule.findUnique({
      where: { userId_date: { userId, date: dateOnly(date) } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async create(userId: string, input: CreateScheduleInput) {
    const data: Prisma.DailyScheduleUncheckedCreateInput = {
      userId,
      date: dateOnly(input.date),
      summary: input.summary ?? null,
      energyLevel: input.energyLevel ?? null,
      mood: input.mood ?? null,
      status: input.status ?? 'DRAFT',
      aiGenerated: input.aiGenerated ?? false,
      wakeUpTime: input.wakeUpTime ? hhmmToDate(input.wakeUpTime) : null,
      sleepTime: input.sleepTime ? hhmmToDate(input.sleepTime) : null,
    };
    try {
      return await this.prisma.dailySchedule.create({ data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A schedule already exists for ${input.date}`);
      }
      throw e;
    }
  }

  async update(userId: string, id: string, input: UpdateScheduleInput) {
    await this.assertOwn(userId, id);
    const data: Prisma.DailyScheduleUpdateInput = {};
    if (input.summary !== undefined) data.summary = input.summary;
    if (input.energyLevel !== undefined) data.energyLevel = input.energyLevel;
    if (input.mood !== undefined) data.mood = input.mood;
    if (input.status !== undefined) data.status = input.status;
    if (input.aiGenerated !== undefined) data.aiGenerated = input.aiGenerated;
    if (input.wakeUpTime !== undefined) {
      data.wakeUpTime = input.wakeUpTime ? hhmmToDate(input.wakeUpTime) : null;
    }
    if (input.sleepTime !== undefined) {
      data.sleepTime = input.sleepTime ? hhmmToDate(input.sleepTime) : null;
    }
    return this.prisma.dailySchedule.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.dailySchedule.delete({ where: { id } });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.dailySchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Schedule not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
