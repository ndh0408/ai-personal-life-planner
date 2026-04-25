import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateSleepLogInput,
  UpdateSleepLogInput,
  SleepLogsRangeQuery,
} from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly } from '../../common/utils/time.util';

function compute(input: CreateSleepLogInput | UpdateSleepLogInput, fallback?: { sleep: Date; wake: Date }): {
  sleepTime?: Date;
  wakeTime?: Date;
  durationMinutes?: number;
} {
  const sleepTime = input.sleepTime ? new Date(input.sleepTime) : fallback?.sleep;
  const wakeTime = input.wakeTime ? new Date(input.wakeTime) : fallback?.wake;
  if (sleepTime && wakeTime) {
    if (wakeTime <= sleepTime) {
      throw new BadRequestException('wakeTime must be after sleepTime');
    }
    return {
      sleepTime,
      wakeTime,
      durationMinutes: Math.round((wakeTime.getTime() - sleepTime.getTime()) / 60_000),
    };
  }
  const out: { sleepTime?: Date; wakeTime?: Date } = {};
  if (sleepTime) out.sleepTime = sleepTime;
  if (wakeTime) out.wakeTime = wakeTime;
  return out;
}

@Injectable()
export class SleepLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateSleepLogInput) {
    const date = dateOnly(input.date);
    const { sleepTime, wakeTime, durationMinutes } = compute(input);
    if (!sleepTime || !wakeTime || durationMinutes === undefined) {
      throw new BadRequestException('sleepTime and wakeTime are required on create');
    }

    return this.prisma.sleepLog.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        sleepTime,
        wakeTime,
        durationMinutes,
        quality: input.quality,
        note: input.note ?? null,
      },
      update: {
        sleepTime,
        wakeTime,
        durationMinutes,
        quality: input.quality,
        note: input.note ?? null,
      },
    });
  }

  list(userId: string, query: SleepLogsRangeQuery) {
    const where: Prisma.SleepLogWhereInput = { userId };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as Prisma.DateTimeFilter).gte = dateOnly(query.from);
      if (query.to) (where.date as Prisma.DateTimeFilter).lte = dateOnly(query.to);
    }
    return this.prisma.sleepLog.findMany({
      where,
      orderBy: { date: 'desc' },
      // Defensive cap — see incomes.service for rationale.
      take: 366,
    });
  }

  async update(userId: string, id: string, input: UpdateSleepLogInput) {
    const existing = await this.assertOwn(userId, id);
    const computed = compute(input, { sleep: existing.sleepTime, wake: existing.wakeTime });
    const data: Prisma.SleepLogUpdateInput = {};
    if (computed.sleepTime) data.sleepTime = computed.sleepTime;
    if (computed.wakeTime) data.wakeTime = computed.wakeTime;
    if (computed.durationMinutes !== undefined) data.durationMinutes = computed.durationMinutes;
    if (input.quality !== undefined) data.quality = input.quality;
    if (input.note !== undefined) data.note = input.note;
    return this.prisma.sleepLog.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.sleepLog.delete({ where: { id } });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.sleepLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Sleep log not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
