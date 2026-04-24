import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AIRecommendationStatus } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { ProactiveNudgeService } from './services/proactive-nudge.service';
import { RecommendationService } from './services/recommendation.service';
import { BehaviorTrackingService } from './services/behavior-tracking.service';
import { AiDailyReviewService } from '../ai/services/ai-daily-review.service';
import { AiInsightService } from '../ai/services/ai-insight.service';
import { AssistantService } from './assistant.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');

const RunDailySchema = z.object({ date: DateStr.optional() }).strict();
const GenerateDailyReviewSchema = z.object({ date: DateStr }).strict();
const GenerateWeeklyReviewSchema = z.object({ weekStart: DateStr }).strict();

const StatusPatchSchema = z
  .object({ status: z.enum(['NEW', 'VIEWED', 'APPLIED', 'DISMISSED']) })
  .strict();

const ListRecommendationsSchema = z
  .object({
    status: z.enum(['NEW', 'VIEWED', 'APPLIED', 'DISMISSED']).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(
    private readonly nudge: ProactiveNudgeService,
    private readonly recommendations: RecommendationService,
    private readonly behavior: BehaviorTrackingService,
    private readonly dailyReview: AiDailyReviewService,
    private readonly weeklyInsight: AiInsightService,
    private readonly legacy: AssistantService,
  ) {}

  /**
   * GET /api/assistant/today
   *
   * Home-screen snapshot: live signals + personal scores + recent
   * recommendations + behavior patterns. Stateless — does NOT create new
   * recommendations / notifications (that's run-daily-monitoring).
   */
  @Get('today')
  async today(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const [snapshot, patterns] = await Promise.all([
      this.nudge.snapshot(user.id, todayYmd(), req),
      this.behavior.analyze(user.id),
    ]);
    return ok({ ...snapshot, patterns }, 'Assistant snapshot ready');
  }

  @Get('recommendations')
  async listRecommendations(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListRecommendationsSchema))
    q: z.infer<typeof ListRecommendationsSchema>,
  ) {
    return ok(
      await this.recommendations.list(user.id, {
        status: q.status as AIRecommendationStatus | undefined,
        limit: q.limit,
      }),
      'Recommendations retrieved',
    );
  }

  @Patch('recommendations/:id/status')
  async patchRecommendationStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(StatusPatchSchema)) body: z.infer<typeof StatusPatchSchema>,
  ) {
    return ok(
      await this.recommendations.patchStatus(
        user.id,
        id,
        body.status as AIRecommendationStatus,
      ),
      'Recommendation updated',
    );
  }

  /**
   * POST /api/assistant/run-daily-monitoring
   *
   * Manual trigger for the assistant orchestrator. Safe to call multiple
   * times (24h dedupe inside RecommendationService). Designed so a future
   * cron/queue can call the same internal `runDaily` method.
   */
  @Post('run-daily-monitoring')
  async runDaily(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RunDailySchema)) body: z.infer<typeof RunDailySchema>,
    @Req() req: Request,
  ) {
    const result = await this.nudge.runDaily(user.id, body.date ?? todayYmd(), req);
    return ok(result, 'Daily monitoring complete');
  }

  @Post('generate-daily-review')
  async generateDailyReview(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GenerateDailyReviewSchema))
    body: z.infer<typeof GenerateDailyReviewSchema>,
    @Req() req: Request,
  ) {
    if (!body.date || !DATE_RE.test(body.date)) {
      throw new BadRequestException({
        message: 'date required',
        errorCode: 'VALIDATION_FAILED',
      });
    }
    const result = await this.dailyReview.review(user.id, { date: body.date }, req);
    return ok(result, 'Daily review generated');
  }

  @Post('generate-weekly-review')
  async generateWeeklyReview(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GenerateWeeklyReviewSchema))
    body: z.infer<typeof GenerateWeeklyReviewSchema>,
    @Req() req: Request,
  ) {
    const result = await this.weeklyInsight.weekly(
      user.id,
      { weekStart: body.weekStart },
      req,
    );
    return ok(result, 'Weekly review generated');
  }

  // Back-compat: the original stub exposed /insights + /insights/:id/dismiss.
  // Mobile has been migrated to /recommendations, but the aliases stay so a
  // stale app binary doesn't break.
  @Get('insights')
  insights(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.legacy.insights(user.id, limit ? Number(limit) : 20);
  }

  @Post('insights/:id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.legacy.dismiss(user.id, id);
  }
}
