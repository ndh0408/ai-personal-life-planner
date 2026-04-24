import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  GenerateScheduleRequestSchema,
  RescheduleRequestSchema,
  ApplyRescheduleRequestSchema,
  SuggestMealsRequestSchema,
  WeeklyInsightRequestSchema,
  AiChatRequestSchema,
  type GenerateScheduleRequest,
  type RescheduleRequest,
  type ApplyRescheduleRequest,
  type SuggestMealsRequest,
  type WeeklyInsightRequest,
  type AiChatRequest,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { AiPlannerService } from './services/ai-planner.service';
import { AiMealService } from './services/ai-meal.service';
import { AiChatService } from './services/ai-chat.service';
import { AiInsightService } from './services/ai-insight.service';

// Tighter rate limit for AI endpoints (provider quotas + cost control).
const AI_THROTTLE = { default: { limit: 12, ttl: 60_000 } };

@Controller('ai')
@UseGuards(JwtAuthGuard)
@Throttle(AI_THROTTLE)
export class AiController {
  constructor(
    private readonly planner: AiPlannerService,
    private readonly meal: AiMealService,
    private readonly chat: AiChatService,
    private readonly insight: AiInsightService,
  ) {}

  @Post('generate-schedule')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GenerateScheduleRequestSchema)) body: GenerateScheduleRequest,
  ) {
    const result = await this.planner.generate(user.id, body);
    return ok(result, result.usedFallback ? 'Plan generated (fallback)' : 'Plan generated');
  }

  @Post('reschedule')
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RescheduleRequestSchema)) body: RescheduleRequest,
  ) {
    const result = await this.planner.preview(user.id, body);
    return ok(result, 'Reschedule preview ready');
  }

  @Post('apply-reschedule')
  async applyReschedule(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ApplyRescheduleRequestSchema)) body: ApplyRescheduleRequest,
  ) {
    const result = await this.planner.apply(user.id, body);
    return ok(result, 'Reschedule applied');
  }

  @Post('suggest-meals')
  async suggestMeals(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SuggestMealsRequestSchema)) body: SuggestMealsRequest,
  ) {
    const result = await this.meal.suggest(user.id, body);
    return ok(result, result.usedFallback ? 'Meals suggested (fallback)' : 'Meals suggested');
  }

  @Post('chat')
  async chatEndpoint(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AiChatRequestSchema)) body: AiChatRequest,
  ) {
    const result = await this.chat.chat(user.id, body);
    return ok(result, 'Reply ready');
  }

  @Post('weekly-insight')
  async weeklyInsight(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(WeeklyInsightRequestSchema)) body: WeeklyInsightRequest,
  ) {
    const result = await this.insight.weekly(user.id, body);
    return ok(result, 'Weekly insight ready');
  }
}
