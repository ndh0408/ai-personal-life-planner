import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS } from './system';

export type WeeklyInsightContext = {
  weekStart: string;
  weekEnd: string;
  taskStats: { completed: number; carriedOver: number; cancelled: number };
  habitStats: Array<{ name: string; targetPerWeek: number; logged: number }>;
  sleepStats: { avgMinutes: number | null; nights: number; goodNights: number };
  moodStats: { dominantMood: string | null; days: number };
};

export function buildWeeklyInsightSystem(): string {
  return `${BASE_GUARDRAILS}

[task:weekly-insight]
Output JSON:
{
  "summary": "1-3 paragraph narrative",
  "goodPoints": ["..."],
  "improvementPoints": ["..."],
  "nextWeekSuggestions": ["..."]
}

Tone: encouraging, practical. Avoid medical claims.`;
}

export function buildWeeklyInsightPrompt(
  _tpl: AiPromptTemplateService,
  ctx: WeeklyInsightContext,
): string {
  const habitLines = ctx.habitStats
    .map((h) => `- ${h.name}: logged ${h.logged}/${h.targetPerWeek}`)
    .join('\n');
  const avgSleep = ctx.sleepStats.avgMinutes
    ? `${Math.round(ctx.sleepStats.avgMinutes / 60)}h${ctx.sleepStats.avgMinutes % 60}m`
    : 'n/a';
  return [
    `Week: ${ctx.weekStart} → ${ctx.weekEnd}`,
    `Tasks: completed=${ctx.taskStats.completed}, carried-over=${ctx.taskStats.carriedOver}, cancelled=${ctx.taskStats.cancelled}`,
    `Habits:\n${habitLines || '(none)'}`,
    `Sleep: avg=${avgSleep} across ${ctx.sleepStats.nights} nights, ${ctx.sleepStats.goodNights} rated GOOD or VERY_GOOD`,
    `Mood: dominant=${ctx.moodStats.dominantMood ?? 'n/a'} across ${ctx.moodStats.days} logged days`,
    '',
    'Respond with JSON only.',
  ].join('\n\n');
}
