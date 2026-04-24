import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS } from './system';

export type GenerateScheduleContext = {
  date: string;
  energyLevel?: string;
  mood?: string;
  extraNote?: string;
  profile: {
    fullName?: string | null;
    age?: number | null;
    occupation?: string | null;
    workStartTime?: string | null;
    workEndTime?: string | null;
    usualWakeTime?: string | null;
    usualSleepTime?: string | null;
    mainGoal?: string | null;
    activityLevel?: string | null;
    dietaryPreference?: string | null;
    timezone?: string | null;
  };
  tasks: Array<{
    title: string;
    priority: string;
    estimatedMinutes?: number | null;
    dueAtIso?: string | null;
  }>;
  habits: Array<{ name: string; targetCount: number; frequency: string }>;
  latestSleep?: { quality: string; durationMinutes: number; date: string } | null;
  latestMood?: { mood: string; energyLevel: string; stressLevel: string; date: string } | null;
};

export function buildGenerateScheduleSystem(): string {
  return `${BASE_GUARDRAILS}

[task:generate-schedule]
You produce a single-day plan as JSON matching this exact shape:
{
  "wakeUpTime": "HH:mm",
  "sleepTime":  "HH:mm",
  "summary": "string (<=2000 chars)",
  "schedule": [
    {
      "title": "string",
      "description": "string",
      "startTime": "HH:mm",
      "endTime":   "HH:mm",
      "type": "SLEEP|MEAL|WORK|STUDY|EXERCISE|REST|TASK|TRAVEL|CUSTOM",
      "priority": "LOW|MEDIUM|HIGH",
      "reason": "short why"
    }
  ],
  "warnings": ["..."],
  "tips": ["..."]
}

Constraints:
- 5-12 blocks; cover wake → sleep with explicit MEAL and REST breaks.
- Use the user's usual wake/sleep times unless they conflict with stated mood/energy.
- Schedule unfinished tasks during the highest-energy window (typically morning).
- Keep blocks aligned to 5-minute boundaries.
- "warnings" is for soft alerts (over-scheduling, late-night work, missed meals).
- "tips" is general lifestyle tips, not medical advice.`;
}

export function buildGenerateSchedulePrompt(
  tpl: AiPromptTemplateService,
  ctx: GenerateScheduleContext,
): string {
  const profile = tpl.blocks({
    'user-profile-fullName': ctx.profile.fullName,
    'user-profile-age': ctx.profile.age,
    'user-profile-occupation': ctx.profile.occupation,
    'user-profile-workWindow': `${ctx.profile.workStartTime ?? '?'} → ${ctx.profile.workEndTime ?? '?'}`,
    'user-profile-usualWake': ctx.profile.usualWakeTime,
    'user-profile-usualSleep': ctx.profile.usualSleepTime,
    'user-profile-mainGoal': ctx.profile.mainGoal,
    'user-profile-activityLevel': ctx.profile.activityLevel,
    'user-profile-dietaryPreference': ctx.profile.dietaryPreference,
    'user-profile-timezone': ctx.profile.timezone,
  });

  const tasks = ctx.tasks
    .map(
      (t, i) =>
        `<user-task-${i}>${tpl.sanitize(t.title)} | priority=${t.priority} | est=${
          t.estimatedMinutes ?? '?'
        }min | due=${t.dueAtIso ?? '?'}</user-task-${i}>`,
    )
    .join('\n');

  const habits = ctx.habits
    .map(
      (h, i) =>
        `<user-habit-${i}>${tpl.sanitize(h.name)} | freq=${h.frequency} | target=${h.targetCount}</user-habit-${i}>`,
    )
    .join('\n');

  const sleep = ctx.latestSleep
    ? `<user-recent-sleep>quality=${ctx.latestSleep.quality} duration=${Math.round(ctx.latestSleep.durationMinutes / 60)}h date=${ctx.latestSleep.date}</user-recent-sleep>`
    : '';
  const mood = ctx.latestMood
    ? `<user-recent-mood>mood=${ctx.latestMood.mood} energy=${ctx.latestMood.energyLevel} stress=${ctx.latestMood.stressLevel} date=${ctx.latestMood.date}</user-recent-mood>`
    : '';

  return [
    `Plan day: ${ctx.date}`,
    ctx.energyLevel ? `Stated energy today: ${ctx.energyLevel}` : '',
    ctx.mood ? `Stated mood today: ${ctx.mood}` : '',
    ctx.extraNote ? `Extra note: ${tpl.sanitize(ctx.extraNote, 600)}` : '',
    profile,
    tasks ? `Tasks to fit:\n${tasks}` : 'No outstanding tasks.',
    habits ? `Habits to honor:\n${habits}` : '',
    sleep,
    mood,
    '',
    'Respond with JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
