import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  RunContextInferenceSchema,
  UpdateContextInferenceStatusSchema,
  type RunContextInferenceInput,
  type UpdateContextInferenceStatusInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { PrivacyService } from '../privacy/privacy.service';
import { RecommendationTriggerService } from './recommendation-trigger.service';
import { UserPatternService } from './user-pattern.service';
import { toContextInferenceDto, toUserPatternDto } from './dto';

@Controller('context')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class ContextInferenceController {
  constructor(
    private readonly trigger: RecommendationTriggerService,
    private readonly patterns: UserPatternService,
    private readonly privacy: PrivacyService,
  ) {}

  @Get('today')
  async today(@CurrentUser() user: AuthUser) {
    const [inferences, patterns, gates] = await Promise.all([
      this.trigger.listToday(user.id),
      this.patterns.list(user.id),
      this.privacy.aiGates(user.id),
    ]);
    return ok(
      {
        inferences: inferences.map(toContextInferenceDto),
        patterns: patterns.map(toUserPatternDto),
        disabledByPrivacy: {
          health: !gates.health,
          finance: !gates.finance,
          schedule: !gates.schedule,
          meal: !gates.meals,
        },
      },
      'OK',
    );
  }

  @Get('inferences')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.trigger.listAll(user.id);
    return ok(rows.map(toContextInferenceDto), 'OK');
  }

  @Patch('inferences/:id/status')
  async patchStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateContextInferenceStatusSchema))
    body: UpdateContextInferenceStatusInput,
  ) {
    return ok(
      toContextInferenceDto(await this.trigger.updateStatus(user.id, id, body.status)),
      'Updated',
    );
  }

  @Post('run')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async run(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RunContextInferenceSchema))
    _body: RunContextInferenceInput,
  ) {
    const r = await this.trigger.run(user.id);
    return ok(
      { inferences: r.inferences.map(toContextInferenceDto), count: r.inferences.length },
      'Run complete',
    );
  }

  @Get('patterns')
  async patternsList(@CurrentUser() user: AuthUser) {
    const rows = await this.patterns.list(user.id);
    return ok(rows.map(toUserPatternDto), 'OK');
  }
}
