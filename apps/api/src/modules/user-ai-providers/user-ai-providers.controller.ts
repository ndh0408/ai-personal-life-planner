import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateUserAiProviderSchema,
  UpdateUserAiProviderSchema,
  UpdateUserAiPreferenceSchema,
  type CreateUserAiProviderInput,
  type UpdateUserAiProviderInput,
  type UpdateUserAiPreferenceInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { UserAiProviderService } from './user-ai-provider.service';
import { UserAiPreferenceService } from './user-ai-preference.service';
import {
  toTestResultDto,
  toUserAiPreferenceDto,
  toUserAiProviderDto,
} from './dto';

/**
 * BYOK endpoints. Tighter throttle than the global default — provider-test
 * calls AI upstream and creates real network egress; CRUD also touches
 * encryption + DB. Auth is mandatory: only the JWT subject's rows are
 * visible.
 */
@Controller()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class UserAiProvidersController {
  constructor(
    private readonly providers: UserAiProviderService,
    private readonly preferences: UserAiPreferenceService,
  ) {}

  // ---- Providers -----------------------------------------------------------

  @Get('user-ai-providers')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.providers.list(user.id);
    return ok(rows.map(toUserAiProviderDto), 'Providers retrieved');
  }

  @Post('user-ai-providers')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateUserAiProviderSchema)) body: CreateUserAiProviderInput,
  ) {
    const row = await this.providers.create(user.id, body);
    return ok(toUserAiProviderDto(row), 'Provider created');
  }

  @Put('user-ai-providers/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserAiProviderSchema)) body: UpdateUserAiProviderInput,
  ) {
    const row = await this.providers.update(user.id, id, body);
    return ok(toUserAiProviderDto(row), 'Provider updated');
  }

  @Delete('user-ai-providers/:id')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.providers.delete(user.id, id);
  }

  @Post('user-ai-providers/:id/test')
  // Each call costs upstream AI tokens. Tightened from 6/min in the
  // enterprise audit. Mobile UX must surface "test in cooldown" instead of
  // letting users hammer.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async test(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.providers.test(user.id, id);
    return ok(toTestResultDto(result), result.ok ? 'Test successful' : 'Test failed');
  }

  // ---- Preferences ---------------------------------------------------------

  @Get('user-ai-preferences')
  async getPref(@CurrentUser() user: AuthUser) {
    const pref = await this.preferences.get(user.id);
    return ok(toUserAiPreferenceDto(pref), 'Preferences retrieved');
  }

  @Put('user-ai-preferences')
  async updatePref(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateUserAiPreferenceSchema)) body: UpdateUserAiPreferenceInput,
  ) {
    const pref = await this.preferences.update(user.id, body);
    return ok(toUserAiPreferenceDto(pref), 'Preferences updated');
  }
}
