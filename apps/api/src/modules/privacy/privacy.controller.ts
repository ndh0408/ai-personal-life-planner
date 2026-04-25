import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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
import {
  toPrivacySettingsDto,
  toRecommendationEvidenceDto,
  toUserConsentDto,
} from './dto';

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
      { ...data, recentConsents: data.recentConsents.map(toUserConsentDto) },
      'Data usage summary',
    );
  }

  @Get('recommendations/:id/evidence')
  async evidence(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const rows = await this.privacy.listRecommendationEvidence(user.id, id);
    return ok(rows.map(toRecommendationEvidenceDto), 'Evidence retrieved');
  }

  /**
   * Build a self-contained JSON export of every row this user owns.
   * Throttled tighter — heavyweight + abuse-attractive. Returns the document
   * inline today; v1.3 will move to an async job.
   */
  @Post('export-data')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async exportData(@CurrentUser() user: AuthUser) {
    const data = await this.privacy.exportUserData(user.id);
    return ok(data, 'Export ready');
  }

  @Post('clear-ai-memory')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async clearAiMemory(@CurrentUser() user: AuthUser) {
    const r = await this.privacy.clearAiMemory(user.id);
    return ok(r, 'AI memory cleared');
  }

  /**
   * Acknowledges the user's request — does not delete immediately. Final
   * deletion will be processed by a 30-day grace job (TBD). For v1 we just
   * record the intent; the next round adds the worker.
   */
  @Post('delete-account-request')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async deleteAccountRequest(@CurrentUser() user: AuthUser) {
    await this.privacy.recordConsent(user.id, {
      consentType: 'PRIVACY_POLICY',
      granted: false,
      version: '2026-04-25-account-deletion-request',
      metadata: { source: 'settings' },
    });
    return ok(
      {
        acknowledged: true,
        scheduledFor: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      'Account deletion requested',
    );
  }
}
