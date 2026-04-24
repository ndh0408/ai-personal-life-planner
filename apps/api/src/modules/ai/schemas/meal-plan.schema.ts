import { z } from 'zod';

const Meal = z.object({
  title: z.string().min(1).max(200),
  ingredients: z.array(z.string().min(1).max(100)).min(1).max(30),
  estimatedCalories: z.number().int().min(0).max(10_000).optional(),
  prepTimeMinutes: z.number().int().min(0).max(720).optional(),
  reason: z.string().max(500),
  healthNote: z.string().max(500).optional(),
});

export const MealSuggestionsSchema = z.object({
  breakfast: Meal,
  lunch: Meal,
  dinner: Meal,
  snack: Meal.optional(),
  notes: z.string().max(1000),
});
export type MealSuggestionsOutput = z.infer<typeof MealSuggestionsSchema>;
