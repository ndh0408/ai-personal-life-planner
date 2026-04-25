import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  UpdateWidgetPreferencesSchema,
  type UpdateWidgetPreferencesInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { WidgetPreferencesService } from './widget-preferences.service';
import { WidgetSummaryService } from './widget-summary.service';
import { toWidgetPreferencesDto } from './dto';

@Controller('widgets')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class WidgetsController {
  constructor(
    private readonly preferences: WidgetPreferencesService,
    private readonly summary: WidgetSummaryService,
  ) {}

  /**
   * The widget pulls this on app foreground / scheduled refresh. Throttled
   * generously (60/min) because the mobile native widget will not call it
   * directly — only the React Native foreground re-fetches and writes the
   * snapshot file the native widget reads.
   */
  @Get('summary')
  async getSummary(@CurrentUser() user: AuthUser) {
    return ok(await this.summary.build(user.id), 'OK');
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthUser) {
    return ok(toWidgetPreferencesDto(await this.preferences.get(user.id)), 'OK');
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateWidgetPreferencesSchema))
    body: UpdateWidgetPreferencesInput,
  ) {
    return ok(
      toWidgetPreferencesDto(await this.preferences.update(user.id, body)),
      'Updated',
    );
  }
}
