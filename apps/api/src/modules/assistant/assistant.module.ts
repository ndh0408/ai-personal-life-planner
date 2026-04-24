import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { DailyMonitoringService } from './services/daily-monitoring.service';
import { RecommendationService } from './services/recommendation.service';
import { BehaviorTrackingService } from './services/behavior-tracking.service';
import { LifeInsightService } from './services/life-insight.service';
import { ProactiveNudgeService } from './services/proactive-nudge.service';

/**
 * Proactive assistant module — distinct from AiModule.
 *
 * AiModule is *reactive*: user-initiated chats, plan-generation, etc.
 * AssistantModule is *proactive*: watches signals across the user's day
 * (under-sleep, skipped meals, over-packed schedule, budget overruns, late
 * tasks, dropped habits, high stress, debt deadlines, stalled goals) and
 * emits recommendations the user never asked for.
 *
 * Architecture:
 *   DailyMonitoringService  → pure signal collector (reads only)
 *   BehaviorTrackingService → pattern analytics over trailing windows
 *   LifeInsightService      → 0..100 personal scores (non-judgmental)
 *   RecommendationService   → CRUD for AIRecommendation with 24h dedupe
 *   ProactiveNudgeService   → orchestrator: signals → recommendations →
 *                             optional NotificationLog respecting quiet
 *                             hours + assistantNudge toggle + locale
 *
 * Scheduling: the orchestrator is callable via POST /run-daily-monitoring.
 * A future cron/queue worker can invoke `ProactiveNudgeService.runDaily`
 * directly without touching the HTTP layer — same signature.
 */
@Module({
  imports: [AiModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    DailyMonitoringService,
    RecommendationService,
    BehaviorTrackingService,
    LifeInsightService,
    ProactiveNudgeService,
  ],
  exports: [
    AssistantService,
    DailyMonitoringService,
    RecommendationService,
    BehaviorTrackingService,
    LifeInsightService,
    ProactiveNudgeService,
  ],
})
export class AssistantModule {}
