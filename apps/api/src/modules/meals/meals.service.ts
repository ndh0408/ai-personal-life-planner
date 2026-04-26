import { Injectable } from '@nestjs/common';
import { Prisma, type MealLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface MealRow {
  id: string;
  title: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  cost: number | null;
  loggedAt: string;
  note: string | null;
}

export interface CreateMealInput {
  title: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  cost?: number | null;
  loggedAtIso: string;
  note?: string | null;
}

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, range: RangeName | null) {
    const where: Record<string, unknown> = { userId };
    if (range) {
      const { start, end } = rangeFor(range);
      where.loggedAt = { gte: start, lt: end };
    }
    const rows = await this.prisma.mealLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });
    return { range, total: rows.length, rows: rows.map(toRow) };
  }

  async create(userId: string, input: CreateMealInput): Promise<MealRow> {
    const row = await this.prisma.mealLog.create({
      data: {
        userId,
        title: input.title.trim(),
        mealType: input.mealType,
        cost: input.cost != null ? new Prisma.Decimal(input.cost) : null,
        loggedAt: new Date(input.loggedAtIso),
        note: input.note?.trim() || null,
      },
    });
    return toRow(row);
  }
}

function toRow(m: MealLog): MealRow {
  return {
    id: m.id,
    title: m.title,
    mealType: m.mealType,
    cost: m.cost ? Number(m.cost) : null,
    loggedAt: m.loggedAt.toISOString(),
    note: m.note,
  };
}
