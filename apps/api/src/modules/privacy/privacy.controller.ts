import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  RecordConsentSchema,
  UpdatePrivacySettingsSchema,
  type RecordConsentInput,
  type UpdatePrivacySettingsInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { PrivacyService } from './privacy.service';
import { toPrivacySettingsDto, toUserConsentDto } from './dto';

/**
 * Privacy / consent endpoints. Throttled tighter than the global default —
 * misbehaving clients should not be able to flood the consent ledger.
 * All endpoints scope to the JWT subject; never accept userId from body/query.
 */
@Controller('privacy')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('settings')
  async get(@CurrentUser() user: AuthUser) {
    const row = await this.privacy.getSettings(user.id);
    return ok(toPrivacySettingsDto(row), 'Privacy settings retrieved');
  }

  @Put('settings')
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdatePrivacySettingsSchema)) body: UpdatePrivacySettingsInput,
  ) {
    const row = await this.privacy.updateSettings(user.id, body);
    return ok(toPrivacySettingsDto(row), 'Privacy settings updated');
  }

  @Post('consent')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async record(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RecordConsentSchema)) body: RecordConsentInput,
  ) {
    const created = await this.privacy.recordConsent(user.id, body);
    return ok(created, 'Consent recorded');
  }

  @Get('consents')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.privacy.listConsents(user.id);
    return ok(rows.map(toUserConsentDto), 'Consents retrieved');
  }

  @Get('data-usage-summary')
  async summary(@CurrentUser() user: AuthUser) {
    const data = await this.privacy.dataUsageSummary(user.id);
    return ok(
      {
        ...data,
        recentConsents: data.recentConsents.map(toUserConsentDto),
      },
      'Data usage summary',
    );
  }
}
