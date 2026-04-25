import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateMoodLogInput,
  UpdateMoodLogInput,
  MoodLogsRangeQuery,
} from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly } from '../../common/utils/time.util';

@Injectable()
export class MoodLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, input: CreateMoodLogInput) {
    const date = dateOnly(input.date);
    return this.prisma.moodLog.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        mood: input.mood,
        energyLevel: input.energyLevel,
        stressLevel: input.stressLevel,
        note: input.note ?? null,
      },
      update: {
        mood: input.mood,
        energyLevel: input.energyLevel,
        stressLevel: input.stressLevel,
        note: input.note ?? null,
      },
    });
  }

  list(userId: string, query: MoodLogsRangeQuery) {
    const where: Prisma.MoodLogWhereInput = { userId };
    if (query.from || query.to) {
      where.date = {};
      if (query.from) (where.date as Prisma.DateTimeFilter).gte = dateOnly(query.from);
      if (query.to) (where.date as Prisma.DateTimeFilter).lte = dateOnly(query.to);
    }
    return this.prisma.moodLog.findMany({
      where,
      orderBy: { date: 'desc' },
      // Defensive cap — see incomes.service for rationale.
      take: 366,
    });
  }

  async update(userId: string, id: string, input: UpdateMoodLogInput) {
    await this.assertOwn(userId, id);
    const data: Prisma.MoodLogUpdateInput = {};
    if (input.mood !== undefined) data.mood = input.mood;
    if (input.energyLevel !== undefined) data.energyLevel = input.energyLevel;
    if (input.stressLevel !== undefined) data.stressLevel = input.stressLevel;
    if (input.note !== undefined) data.note = input.note;
    return this.prisma.moodLog.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.moodLog.delete({ where: { id } });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.moodLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Mood log not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
