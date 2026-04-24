import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  GenerateScheduleRequestSchema,
  RescheduleRequestSchema,
  ApplyRescheduleRequestSchema,
  SuggestMealsRequestSchema,
  WeeklyInsightRequestSchema,
  DailyReviewRequestSchema,
  AnalyzeFinanceRequestSchema,
  AiChatRequestSchema,
  type GenerateScheduleRequest,
  type RescheduleRequest,
  type ApplyRescheduleRequest,
  type SuggestMealsRequest,
  type WeeklyInsightRequest,
  type DailyReviewRequest,
  type AnalyzeFinanceRequest,
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
import { AiDailyReviewService } from './services/ai-daily-review.service';
import { AiFinanceService } from './services/ai-finance.service';

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
    private readonly dailyReview: AiDailyReviewService,
    private readonly finance: AiFinanceService,
  ) {}

  @Post('generate-schedule')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GenerateScheduleRequestSchema)) body: GenerateScheduleRequest,
    @Req() req: Request,
  ) {
    const result = await this.planner.generate(user.id, body, req);
    return ok(result, result.usedFallback ? 'Plan generated (fallback)' : 'Plan generated');
  }

  @Post('reschedule')
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RescheduleRequestSchema)) body: RescheduleRequest,
    @Req() req: Request,
  ) {
    const result = await this.planner.preview(user.id, body, req);
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
    @Req() req: Request,
  ) {
    const result = await this.meal.suggest(user.id, body, req);
    return ok(result, result.usedFallback ? 'Meals suggested (fallback)' : 'Meals suggested');
  }

  @Post('analyze-finance')
  async analyzeFinance(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AnalyzeFinanceRequestSchema)) body: AnalyzeFinanceRequest,
    @Req() req: Request,
  ) {
    const result = await this.finance.analyze(user.id, body, req);
    return ok(result, result.usedFallback ? 'Finance analysis (fallback)' : 'Finance analysis ready');
  }

  @Post('daily-review')
  async dailyReviewEndpoint(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(DailyReviewRequestSchema)) body: DailyReviewRequest,
    @Req() req: Request,
  ) {
    const result = await this.dailyReview.review(user.id, body, req);
    return ok(result, result.usedFallback ? 'Daily review (fallback)' : 'Daily review ready');
  }

  @Post('weekly-insight')
  async weeklyInsight(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(WeeklyInsightRequestSchema)) body: WeeklyInsightRequest,
    @Req() req: Request,
  ) {
    const result = await this.insight.weekly(user.id, body, req);
    return ok(result, result.usedFallback ? 'Weekly insight (fallback)' : 'Weekly insight ready');
  }

  @Post('chat')
  async chatEndpoint(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AiChatRequestSchema)) body: AiChatRequest,
    @Req() req: Request,
  ) {
    const result = await this.chat.chat(user.id, body, req);
    return ok(result, 'Reply ready');
  }
}
