import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * Proactive assistant module — distinct from AiModule.
 *
 * AiModule is *reactive*: it handles user-initiated chats, plan-generation
 * requests, and other one-shot AI calls. AssistantModule is *proactive*: it
 * runs on a schedule, watches signals (under-sleep, skipped meals, over-packed
 * schedules, budget overruns, late tasks, dropped habits, high stress), and
 * emits insights the user never asked for.
 *
 * Scope for this iteration is foundation only. Full implementation will add:
 * - a worker / cron that scans user data on a cadence,
 * - a rules+LLM hybrid that decides whether an insight is worth sending,
 * - the AiRecommendation table (already in schema.prisma) as the sink,
 * - push delivery via NotificationsModule.
 */
@Module({
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
