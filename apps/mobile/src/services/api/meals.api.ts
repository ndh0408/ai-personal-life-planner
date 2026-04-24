import { api } from './client';
import type { CreateMealPlanInput, UpdateMealPlanInput } from '@planner/shared';

export type MealSuggestion = {
  id: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  title: string;
  description: string | null;
  ingredients: string[];
  estimatedCalories: number | null;
  prepTimeMinutes: number | null;
  reason: string | null;
  healthNote: string | null;
};

export type MealPlan = {
  id: string;
  userId: string;
  date: string;
  goal: string | null;
  budget: string | null;
  availableIngredients: string[];
  notes: string | null;
  suggestions: MealSuggestion[];
};

export const mealsApi = {
  byDate: (date: string) => api.get<MealPlan | null>(`/meals?date=${date}`),
  create: (input: CreateMealPlanInput) => api.post<MealPlan>('/meals', input),
  update: (id: string, input: UpdateMealPlanInput) => api.put<MealPlan>(`/meals/${id}`, input),
  remove: (id: string) => api.delete<null>(`/meals/${id}`),
};
