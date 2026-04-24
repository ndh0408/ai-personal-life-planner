import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS } from './system';

export type MealContext = {
  date: string;
  goal?: string;
  budget?: string;
  availableIngredients?: string[];
  cookingTimeMinutes?: number;
  profile: { dietaryPreference?: string | null; mainGoal?: string | null; activityLevel?: string | null };
};

export function buildMealSystem(): string {
  return `${BASE_GUARDRAILS}

[task:meal-suggestion]
Output JSON:
{
  "breakfast": {"title":"...", "ingredients":["..."], "estimatedCalories":NN, "prepTimeMinutes":NN, "reason":"...", "healthNote":"..."},
  "lunch": {...},
  "dinner": {...},
  "snack": {...},     // optional
  "notes": "string (<=1000)"
}

Rules:
- Use the user's available ingredients first; supplement with common pantry staples.
- Honor dietary preference and main goal.
- No medical claims (e.g. "cures", "treats"). Generic guidance only.
- prepTimeMinutes for any single meal must not exceed the user's cookingTimeMinutes if provided.`;
}

export function buildMealPrompt(tpl: AiPromptTemplateService, ctx: MealContext): string {
  return [
    `Plan meals for date ${ctx.date}.`,
    ctx.goal ? `Goal: ${tpl.sanitize(ctx.goal, 200)}` : '',
    ctx.budget ? `Budget: ${tpl.sanitize(ctx.budget, 100)}` : '',
    ctx.cookingTimeMinutes ? `Max cooking time per meal: ${ctx.cookingTimeMinutes} min` : '',
    tpl.blocks({
      'user-dietaryPreference': ctx.profile.dietaryPreference,
      'user-mainGoal': ctx.profile.mainGoal,
      'user-activityLevel': ctx.profile.activityLevel,
    }),
    ctx.availableIngredients?.length
      ? `<user-ingredients>${ctx.availableIngredients.map((i) => tpl.sanitize(i, 60)).join(', ')}</user-ingredients>`
      : '',
    '',
    'Respond with JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
