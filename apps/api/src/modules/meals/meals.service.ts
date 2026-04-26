import { Injectable } from '@nestjs/common';
import type { MealLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface MealRow {
  id: string;
  title: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  cost: number | null;
  loggedAt: string;
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
}

function toRow(m: MealLog): MealRow {
  return {
    id: m.id,
    title: m.title,
    mealType: m.mealType,
    cost: m.cost ? Number(m.cost) : null,
    loggedAt: m.loggedAt.toISOString(),
  };
}
