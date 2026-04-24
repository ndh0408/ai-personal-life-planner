import { z } from 'zod';

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');
export const MealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);

export const MealSuggestionInputSchema = z.object({
  mealType: MealTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ingredients: z.array(z.string().min(1).max(100)).min(1).max(50),
  estimatedCalories: z.number().int().min(0).max(10000).optional(),
  prepTimeMinutes: z.number().int().min(0).max(720).optional(),
  reason: z.string().max(500).optional(),
  healthNote: z.string().max(500).optional(),
});

export const CreateMealPlanSchema = z.object({
  date: DateOnly,
  goal: z.string().max(200).optional(),
  budget: z.string().max(50).optional(),
  availableIngredients: z.array(z.string().min(1).max(100)).max(100).optional(),
  notes: z.string().max(2000).optional(),
  suggestions: z.array(MealSuggestionInputSchema).max(20).optional(),
});
export type CreateMealPlanInput = z.infer<typeof CreateMealPlanSchema>;

export const UpdateMealPlanSchema = CreateMealPlanSchema.partial().omit({ date: true });
export type UpdateMealPlanInput = z.infer<typeof UpdateMealPlanSchema>;

export const GetMealPlanQuerySchema = z.object({
  date: DateOnly,
});
export type GetMealPlanQuery = z.infer<typeof GetMealPlanQuerySchema>;
