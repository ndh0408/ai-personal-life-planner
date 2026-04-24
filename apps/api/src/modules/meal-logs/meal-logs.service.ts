import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MealType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateMealLogInput = {
  date: string; // YYYY-MM-DD
  mealType: MealType;
  title: string;
  note?: string;
  estimatedCalories?: number;
  cost?: number;
};

export type UpdateMealLogInput = Partial<CreateMealLogInput>;

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class MealLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, from?: string, to?: string, mealType?: MealType) {
    const where: Prisma.MealLogWhereInput = { userId };
    if (mealType) where.mealType = mealType;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Prisma.DateTimeFilter).gte = toDate(from);
      if (to) (where.date as Prisma.DateTimeFilter).lte = toDate(to);
    }
    return this.prisma.mealLog.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    const row = await this.prisma.mealLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Meal log not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  create(userId: string, input: CreateMealLogInput) {
    return this.prisma.mealLog.create({
      data: {
        userId,
        date: toDate(input.date),
        mealType: input.mealType,
        title: input.title,
        note: input.note ?? null,
        estimatedCalories: input.estimatedCalories ?? null,
        cost: input.cost ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateMealLogInput) {
    await this.getById(userId, id);
    const data: Prisma.MealLogUpdateInput = {};
    if (input.date !== undefined) data.date = toDate(input.date);
    if (input.mealType !== undefined) data.mealType = input.mealType;
    if (input.title !== undefined) data.title = input.title;
    if (input.note !== undefined) data.note = input.note;
    if (input.estimatedCalories !== undefined) data.estimatedCalories = input.estimatedCalories;
    if (input.cost !== undefined) data.cost = input.cost;
    return this.prisma.mealLog.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.mealLog.delete({ where: { id } });
  }
}
