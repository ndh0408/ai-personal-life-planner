import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService, briefAiError } from './ai-provider.service';
import { AiProviderResolverService } from './ai-provider-resolver.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { dateOnly } from '../../../common/utils/time.util';
import { MealSuggestionsSchema, type MealSuggestionsOutput } from '../schemas/meal-plan.schema';
import {
  buildMealPrompt,
  buildMealSystem,
  type MealContext,
} from '../prompts/meal-suggestion.prompt';

export interface SuggestMealsInput {
  date: string;
  goal?: string;
  budget?: string;
  availableIngredients?: string[];
  cookingTimeMinutes?: number;
  /** When true, persist the resulting plan + suggestions. */
  save?: boolean;
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

const FALLBACK: MealSuggestionsOutput = {
  breakfast: { title: 'Oats + fruit', ingredients: ['oats', 'fruit'], reason: 'fallback' },
  lunch: { title: 'Rice + protein + veggies', ingredients: ['rice', 'protein', 'vegetables'], reason: 'fallback' },
  dinner: { title: 'Light salad + protein', ingredients: ['greens', 'protein'], reason: 'fallback' },
  snack: { title: 'Yogurt + nuts', ingredients: ['yogurt', 'nuts'], reason: 'fallback' },
  notes: 'AI fallback used — generic meals.',
};

@Injectable()
export class AiMealService {
  private readonly logger = new Logger(AiMealService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly locale: LocaleService,
    private readonly resolver: AiProviderResolverService,
  ) {}

  async suggest(userId: string, input: SuggestMealsInput, req: RequestLike = {}) {
    const localeTag = await this.locale.forUser(userId, req);
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const ctx: MealContext = {
      date: input.date,
      goal: input.goal,
      budget: input.budget,
      availableIngredients: input.availableIngredients,
      cookingTimeMinutes: input.cookingTimeMinutes,
      profile: {
        dietaryPreference: profile?.dietaryPreference ?? null,
        mainGoal: profile?.mainGoal ?? null,
        activityLevel: profile?.activityLevel ?? null,
      },
    };

    const system = buildMealSystem(localeTag);
    const prompt = buildMealPrompt(this.tpl, ctx);

    let suggestions: MealSuggestionsOutput;
    let usedFallback = false;
    try {
      const completion = await this.resolver.completeForUser(
        userId,
        'meal',
        { system, prompt, jsonMode: true, maxTokens: 1500, temperature: 0.6 },
      );
      suggestions = await this.json.parseAndValidate(completion.text, MealSuggestionsSchema, {
        task: 'meal-suggestion',
        system,
      });
    } catch (e) {
      this.logger.warn(`meal-suggestion fell back: ${briefAiError(e)}`);
      usedFallback = true;
      suggestions = FALLBACK;
    }

    let saved = null;
    if (input.save) {
      saved = await this.persist(userId, input, suggestions);
    }
    return { suggestions, saved, usedFallback };
  }

  private async persist(userId: string, input: SuggestMealsInput, s: MealSuggestionsOutput) {
    const date = dateOnly(input.date);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.mealPlan.findUnique({ where: { userId_date: { userId, date } } });
      if (existing) {
        await tx.mealSuggestion.deleteMany({ where: { mealPlanId: existing.id } });
        return tx.mealPlan.update({
          where: { id: existing.id },
          data: {
            goal: input.goal ?? null,
            budget: input.budget ?? null,
            availableIngredients: input.availableIngredients ?? [],
            suggestions: { create: this.toRows(s, userId) },
          },
          include: { suggestions: true },
        });
      }
      return tx.mealPlan.create({
        data: {
          userId,
          date,
          goal: input.goal ?? null,
          budget: input.budget ?? null,
          availableIngredients: input.availableIngredients ?? [],
          suggestions: { create: this.toRows(s, userId) },
        },
        include: { suggestions: true },
      });
    });
  }

  private toRows(s: MealSuggestionsOutput, userId: string) {
    const rows: Array<{
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
      title: string;
      ingredients: string[];
      estimatedCalories?: number;
      prepTimeMinutes?: number;
      reason: string;
      healthNote?: string;
    }> = [
      { ...s.breakfast, mealType: 'BREAKFAST' },
      { ...s.lunch, mealType: 'LUNCH' },
      { ...s.dinner, mealType: 'DINNER' },
    ];
    if (s.snack) rows.push({ ...s.snack, mealType: 'SNACK' });
    return rows.map((r) => ({
      userId,
      mealType: r.mealType,
      title: r.title,
      ingredients: r.ingredients,
      estimatedCalories: r.estimatedCalories ?? null,
      prepTimeMinutes: r.prepTimeMinutes ?? null,
      reason: r.reason ?? null,
      healthNote: r.healthNote ?? null,
    }));
  }
}
