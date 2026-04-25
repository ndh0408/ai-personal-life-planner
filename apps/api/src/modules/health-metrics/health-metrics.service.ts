import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateHealthMetricInput = {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  waterIntakeMl?: number;
  steps?: number;
  exerciseMinutes?: number;
  note?: string;
};

export type UpdateHealthMetricInput = Partial<CreateHealthMetricInput>;

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class HealthMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, from?: string, to?: string) {
    const where: Prisma.HealthMetricWhereInput = { userId };
    if (from || to) {
      where.date = {};
      if (from) (where.date as Prisma.DateTimeFilter).gte = toDate(from);
      if (to) (where.date as Prisma.DateTimeFilter).lte = toDate(to);
    }
    return this.prisma.healthMetric.findMany({
      where,
      orderBy: { date: 'desc' },
      // Defensive cap — see incomes.service for rationale.
      take: 366,
    });
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.healthMetric.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Health metric not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  create(userId: string, input: CreateHealthMetricInput) {
    return this.prisma.healthMetric.create({
      data: {
        userId,
        date: toDate(input.date),
        weightKg: input.weightKg ?? null,
        waterIntakeMl: input.waterIntakeMl ?? null,
        steps: input.steps ?? null,
        exerciseMinutes: input.exerciseMinutes ?? null,
        note: input.note ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateHealthMetricInput) {
    await this.getById(userId, id);
    const data: Prisma.HealthMetricUpdateInput = {};
    if (input.date !== undefined) data.date = toDate(input.date);
    if (input.weightKg !== undefined) data.weightKg = input.weightKg;
    if (input.waterIntakeMl !== undefined) data.waterIntakeMl = input.waterIntakeMl;
    if (input.steps !== undefined) data.steps = input.steps;
    if (input.exerciseMinutes !== undefined) data.exerciseMinutes = input.exerciseMinutes;
    if (input.note !== undefined) data.note = input.note;
    return this.prisma.healthMetric.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.healthMetric.delete({ where: { id } });
  }
}
