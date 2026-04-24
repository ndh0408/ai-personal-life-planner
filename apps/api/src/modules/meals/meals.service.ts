import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateMealPlanInput, UpdateMealPlanInput } from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { dateOnly } from '../../common/utils/time.util';

type SuggestionInput = NonNullable<CreateMealPlanInput['suggestions']>[number];

function suggestionData(s: SuggestionInput, userId: string) {
  return {
    userId,
    mealType: s.mealType,
    title: s.title,
    description: s.description ?? null,
    ingredients: s.ingredients,
    estimatedCalories: s.estimatedCalories ?? null,
    prepTimeMinutes: s.prepTimeMinutes ?? null,
    reason: s.reason ?? null,
    healthNote: s.healthNote ?? null,
  };
}

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  getByDate(userId: string, date: string) {
    return this.prisma.mealPlan.findUnique({
      where: { userId_date: { userId, date: dateOnly(date) } },
      include: { suggestions: { orderBy: { mealType: 'asc' } } },
    });
  }

  async create(userId: string, input: CreateMealPlanInput) {
    try {
      return await this.prisma.mealPlan.create({
        data: {
          userId,
          date: dateOnly(input.date),
          goal: input.goal ?? null,
          budget: input.budget ?? null,
          availableIngredients: input.availableIngredients ?? [],
          notes: input.notes ?? null,
          suggestions: input.suggestions
            ? { create: input.suggestions.map((s) => suggestionData(s, userId)) }
            : undefined,
        },
        include: { suggestions: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A meal plan already exists for ${input.date}`);
      }
      throw e;
    }
  }

  async update(userId: string, id: string, input: UpdateMealPlanInput) {
    await this.assertOwn(userId, id);

    const data: Prisma.MealPlanUpdateInput = {};
    if (input.goal !== undefined) data.goal = input.goal;
    if (input.budget !== undefined) data.budget = input.budget;
    if (input.availableIngredients !== undefined) data.availableIngredients = input.availableIngredients;
    if (input.notes !== undefined) data.notes = input.notes;

    // If suggestions provided, replace the set atomically.
    if (input.suggestions !== undefined) {
      return this.prisma.$transaction(async (tx) => {
        await tx.mealSuggestion.deleteMany({ where: { mealPlanId: id } });
        return tx.mealPlan.update({
          where: { id },
          data: {
            ...data,
            suggestions: { create: input.suggestions!.map((s) => suggestionData(s, userId)) },
          },
          include: { suggestions: true },
        });
      });
    }

    return this.prisma.mealPlan.update({
      where: { id },
      data,
      include: { suggestions: true },
    });
  }

  async delete(userId: string, id: string) {
    await this.assertOwn(userId, id);
    await this.prisma.mealPlan.delete({ where: { id } });
  }

  private async assertOwn(userId: string, id: string) {
    const row = await this.prisma.mealPlan.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Meal plan not found');
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }
}
