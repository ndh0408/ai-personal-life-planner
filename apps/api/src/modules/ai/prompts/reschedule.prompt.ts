import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS } from './system';

export type RescheduleContext = {
  date: string;
  currentTime: string;
  delayMinutes: number;
  mustKeepItemIds?: string[];
  priorityNote?: string;
  items: Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    startTime: string; // HH:mm
    endTime: string;
    status: string;
  }>;
};

export function buildRescheduleSystem(): string {
  return `${BASE_GUARDRAILS}

[task:reschedule]
You absorb a delay into an existing day's plan. Output JSON:
{
  "summary": "one-paragraph explanation",
  "kept":      [{"id":"...", "reason":"why kept as-is"}],
  "shortened": [{"id":"...", "minutesRemoved":NN, "reason":"..."}],
  "removed":   [{"id":"...", "reason":"..."}],
  "warnings":  ["..."]
}

Rules:
- Items in <user-must-keep> MUST be in "kept", at full duration.
- Prefer shortening LOW-priority items before MEDIUM, MEDIUM before HIGH.
- Removing is a last resort; explain why.
- Never push items past the user's usual sleep time.`;
}

export function buildReschedulePrompt(
  tpl: AiPromptTemplateService,
  ctx: RescheduleContext,
): string {
  const must = (ctx.mustKeepItemIds ?? []).join(',');
  const items = ctx.items
    .map(
      (i, n) =>
        `<user-item-${n}>id=${i.id} | ${tpl.sanitize(i.title)} | ${i.type} | ${i.priority} | ${i.startTime}-${i.endTime} | ${i.status}</user-item-${n}>`,
    )
    .join('\n');

  return [
    `Reschedule for date ${ctx.date}.`,
    `Current time: ${ctx.currentTime}.`,
    `Delay to absorb: ${ctx.delayMinutes} minutes.`,
    must ? `<user-must-keep>${tpl.sanitize(must, 500)}</user-must-keep>` : '',
    ctx.priorityNote ? `Priority note: ${tpl.sanitize(ctx.priorityNote, 500)}` : '',
    'Existing items:',
    items,
    '',
    'Respond with JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
