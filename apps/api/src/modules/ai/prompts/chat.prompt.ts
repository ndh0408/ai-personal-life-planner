import type { AiPromptTemplateService } from '../services/ai-prompt-template.service';
import { BASE_GUARDRAILS, buildLanguageDirective, type Locale } from './system';

export type ChatContext = {
  message: string;
  contextType?: string;
  history: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>;
  userSnapshot: { mainGoal?: string | null; activityLevel?: string | null; timezone?: string | null };
};

export function buildChatSystem(locale: Locale = 'vi'): string {
  return `${BASE_GUARDRAILS}

${buildLanguageDirective(locale)}

[task:chat]
You answer the user's message conversationally and may suggest 0-3 actions
the app could perform. Output JSON:
{
  "answer": "string",
  "suggestedActions": [
    {"type":"add_schedule_item|add_task|log_habit|...", "title":"...", "startTime":"HH:mm", "endTime":"HH:mm", "payload":{...}}
  ]
}

Rules:
- "answer" is plain text, friendly, <=4000 chars.
- Suggested actions must be plausible and concrete; otherwise return [].
- No medical advice. No promises about future events.`;
}

export function buildChatPrompt(tpl: AiPromptTemplateService, ctx: ChatContext): string {
  const history = ctx.history
    .slice(-8) // last 8 turns max
    .map(
      (m, i) =>
        `<user-history-${i} role="${m.role}">${tpl.sanitize(m.content, 1500)}</user-history-${i}>`,
    )
    .join('\n');
  return [
    ctx.contextType ? `Conversation context: ${tpl.sanitize(ctx.contextType, 80)}` : '',
    tpl.blocks({
      'user-snapshot-goal': ctx.userSnapshot.mainGoal,
      'user-snapshot-activity': ctx.userSnapshot.activityLevel,
      'user-snapshot-timezone': ctx.userSnapshot.timezone,
    }),
    history ? `Recent turns:\n${history}` : '',
    `<user-message>${tpl.sanitize(ctx.message, 4000)}</user-message>`,
    '',
    'Respond with JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
