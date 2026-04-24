import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS, buildLanguageDirective, type Locale } from './system';

export type DailyReviewContext = {
  date: string;
  schedule: {
    present: boolean;
    completed: number;
    total: number;
    pending: number;
    skipped: number;
    delayed: number;
  };
  tasks: { completed: number; inProgress: number; todo: number };
  habits: { logged: number; completed: number; active: number };
  meals: {
    planCount: number;
    logCount: number;
    estimatedCaloriesSum: number | null;
    cost: number | null;
  };
  sleep: { durationMinutes: number | null; quality: string | null } | null;
  mood: { mood: string; energyLevel: string; stressLevel: string } | null;
  expenses: { total: number; count: number; byNeed: Array<{ level: string; amount: number }> };
  goals: Array<{ title: string; progressPercent: number | null }>;
  currency: string;
};

export function buildDailyReviewSystem(locale: Locale = 'vi'): string {
  return `${BASE_GUARDRAILS}

${buildLanguageDirective(locale)}

[task:daily-review]
You review a user's day across schedule, tasks, habits, meals, wellbeing,
spending, and goals, and return a supportive, practical review. Output JSON:
{
  "todaySummary": "one paragraph",
  "wins": ["string",...],
  "issues": ["string",...],
  "suggestionsForTomorrow": ["string",...],
  "healthAdvice": "string",
  "financeAdvice": "string",
  "productivityAdvice": "string"
}

Rules:
- Keep each advice field short (<=400 chars).
- Never medical/psychiatric advice; never investment advice.
- "issues" is factual observations, not judgment. Frame gently.
- If data is sparse in a domain, acknowledge briefly instead of inventing.
- All text MUST follow the Language directive above.`;
}

export function buildDailyReviewPrompt(
  _tpl: AiPromptTemplateService,
  ctx: DailyReviewContext,
): string {
  const byNeed = ctx.expenses.byNeed
    .map((n) => `${n.level}=${n.amount}`)
    .join(' | ');
  const goals = ctx.goals
    .slice(0, 5)
    .map((g) => `- ${g.title} (${g.progressPercent ?? 'n/a'}%)`)
    .join('\n');
  return [
    `Date: ${ctx.date}`,
    `Schedule: present=${ctx.schedule.present ? 'yes' : 'no'}, completed=${ctx.schedule.completed}/${ctx.schedule.total}, pending=${ctx.schedule.pending}, skipped=${ctx.schedule.skipped}, delayed=${ctx.schedule.delayed}`,
    `Tasks: done=${ctx.tasks.completed}, inProgress=${ctx.tasks.inProgress}, todo=${ctx.tasks.todo}`,
    `Habits: logged=${ctx.habits.logged}, completed=${ctx.habits.completed}, activeHabits=${ctx.habits.active}`,
    `Meals: plan=${ctx.meals.planCount}, logs=${ctx.meals.logCount}, cal=${ctx.meals.estimatedCaloriesSum ?? 'n/a'}, cost=${ctx.meals.cost ?? 'n/a'} ${ctx.currency}`,
    ctx.sleep
      ? `Sleep: ${ctx.sleep.durationMinutes ?? 'n/a'} min, quality=${ctx.sleep.quality ?? 'n/a'}`
      : 'Sleep: no entry',
    ctx.mood
      ? `Mood: mood=${ctx.mood.mood}, energy=${ctx.mood.energyLevel}, stress=${ctx.mood.stressLevel}`
      : 'Mood: no entry',
    `Expenses: ${ctx.expenses.total} ${ctx.currency} across ${ctx.expenses.count} items | ${byNeed || 'n/a'}`,
    goals ? `Active goals:\n${goals}` : 'No active goals.',
    '',
    'Respond with JSON only.',
  ].join('\n\n');
}
