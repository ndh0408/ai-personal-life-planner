import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConnectedAccountProvider } from '@prisma/client';
import {
  ConnectedAccountProviderSchema,
  CreateAiCompanionMemorySchema,
  CreateEmailReminderFromEmailSchema,
  CreateEmailReminderSchema,
  CreateMessageReminderSchema,
  ListEmailsQuerySchema,
  UpdateAiCompanionMemorySchema,
  UpdateCommunicationSettingsSchema,
  UpdateEmailReminderStatusSchema,
  UpdateEmailStatusSchema,
  UpdateMemoryConsentSchema,
  UpdateMessageReminderStatusSchema,
  type CreateAiCompanionMemoryInput,
  type CreateEmailReminderFromEmailInput,
  type CreateEmailReminderInput,
  type CreateMessageReminderInput,
  type ListEmailsQuery,
  type UpdateAiCompanionMemoryInput,
  type UpdateCommunicationSettingsInput,
  type UpdateEmailReminderStatusInput,
  type UpdateEmailStatusInput,
  type UpdateMemoryConsentInput,
  type UpdateMessageReminderStatusInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { CommunicationSettingsService } from './communication-settings.service';
import { ConnectedAccountsService } from './connected-accounts.service';
import { EmailService } from './email.service';
import { RemindersService } from './reminders.service';
import { CompanionMemoryService } from './companion-memory.service';
import { AiCommunicationService } from './ai-communication.service';
import {
  toCommunicationSettingsDto,
  toCompanionMemoryDto,
  toConnectedAccountDto,
  toEmailItemDto,
  toEmailReminderDto,
  toMemoryConsentDto,
  toMessageReminderDto,
} from './dto';

/**
 * Single Nest controller surface for the v1.2 Communication Assistant.
 * Path-based routing keeps the spec route shapes; throttles align with
 * privacy + cost surface area:
 *   • CRUD: 30/min default
 *   • email/sync: 6/min (touches upstream OAuth)
 *   • email/:id/analyze: 10/min (each call costs upstream tokens)
 *   • OAuth start/callback: 10/min
 */
@Controller()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class CommunicationController {
  constructor(
    private readonly settings: CommunicationSettingsService,
    private readonly accounts: ConnectedAccountsService,
    private readonly emails: EmailService,
    private readonly reminders: RemindersService,
    private readonly memory: CompanionMemoryService,
    private readonly aiComms: AiCommunicationService,
  ) {}

  // ---- Settings ------------------------------------------------------------

  @Get('communication/settings')
  async getSettings(@CurrentUser() user: AuthUser) {
    return ok(toCommunicationSettingsDto(await this.settings.getSettings(user.id)), 'OK');
  }

  @Put('communication/settings')
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateCommunicationSettingsSchema))
    body: UpdateCommunicationSettingsInput,
  ) {
    return ok(
      toCommunicationSettingsDto(await this.settings.updateSettings(user.id, body)),
      'Updated',
    );
  }

  // ---- Connected accounts (OAuth shape; upstream exchange in v1.3) --------

  @Get('connected-accounts')
  async listAccounts(@CurrentUser() user: AuthUser) {
    const rows = await this.accounts.list(user.id);
    return ok(rows.map(toConnectedAccountDto), 'OK');
  }

  @Post('connected-accounts/gmail/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startGmail(@CurrentUser() user: AuthUser) {
    return this.accounts.startOAuth(user.id, ConnectedAccountProvider.GMAIL).then((r) => ok(r));
  }

  @Get('connected-accounts/gmail/callback')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async gmailCallback(@Query('state') state: string, @Query('code') code: string) {
    if (!state || !code) {
      throw new BadRequestException({
        message: 'Missing OAuth state/code',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    const row = await this.accounts.completeOAuth(
      ConnectedAccountProvider.GMAIL,
      state,
      code,
    );
    return ok(toConnectedAccountDto(row), 'Connected');
  }

  @Post('connected-accounts/outlook/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startOutlook(@CurrentUser() user: AuthUser) {
    return this.accounts.startOAuth(user.id, ConnectedAccountProvider.OUTLOOK).then((r) => ok(r));
  }

  @Get('connected-accounts/outlook/callback')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async outlookCallback(@Query('state') state: string, @Query('code') code: string) {
    if (!state || !code) {
      throw new BadRequestException({
        message: 'Missing OAuth state/code',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    const row = await this.accounts.completeOAuth(
      ConnectedAccountProvider.OUTLOOK,
      state,
      code,
    );
    return ok(toConnectedAccountDto(row), 'Connected');
  }

  @Delete('connected-accounts/:id')
  @HttpCode(204)
  async disconnect(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.accounts.disconnect(user.id, id);
  }

  // ---- Emails --------------------------------------------------------------

  @Get('emails')
  async listEmails(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListEmailsQuerySchema)) q: ListEmailsQuery,
  ) {
    const r = await this.emails.list(user.id, q);
    return ok({ ...r, items: r.items.map(toEmailItemDto) }, 'OK');
  }

  @Get('emails/:id')
  async getEmail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return ok(toEmailItemDto(await this.emails.getById(user.id, id)), 'OK');
  }

  @Post('emails/sync')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async sync(@CurrentUser() user: AuthUser) {
    return ok(await this.emails.syncFor(user.id), 'Sync requested');
  }

  @Post('emails/:id/analyze')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async analyze(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const email = await this.emails.getById(user.id, id);
    // Body is intentionally NOT passed: the v1.2 sync layer doesn't store
    // it. v1.3 will pass body when emailFullContentAnalysis is on.
    const analysis = await this.aiComms.analyzeEmail(user.id, email);
    if (!analysis.usedFallback && !analysis.disabledByPrivacy) {
      await this.emails.applyAnalysis(user.id, id, analysis);
    }
    return ok(analysis, 'Analyzed');
  }

  @Post('emails/:id/create-reminder')
  async createReminderFromEmail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CreateEmailReminderFromEmailSchema))
    body: CreateEmailReminderFromEmailInput,
  ) {
    // Re-use the email reminders create path with emailItemId pinned.
    const created = await this.reminders.createEmailReminder(user.id, {
      emailItemId: id,
      title: body.title,
      note: body.note,
      remindAt: body.remindAt,
    });
    return ok(toEmailReminderDto(created), 'Reminder created');
  }

  @Patch('emails/:id/status')
  async patchEmailStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateEmailStatusSchema)) body: UpdateEmailStatusInput,
  ) {
    return ok(toEmailItemDto(await this.emails.updateStatus(user.id, id, body)), 'Updated');
  }

  // ---- Email reminders -----------------------------------------------------

  @Get('email-reminders')
  async listEmailReminders(@CurrentUser() user: AuthUser) {
    const rows = await this.reminders.listEmailReminders(user.id);
    return ok(rows.map(toEmailReminderDto), 'OK');
  }

  @Post('email-reminders')
  async createEmailReminder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateEmailReminderSchema)) body: CreateEmailReminderInput,
  ) {
    const r = await this.reminders.createEmailReminder(user.id, body);
    return ok(toEmailReminderDto(r), 'Created');
  }

  @Patch('email-reminders/:id/status')
  async patchEmailReminder(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateEmailReminderStatusSchema))
    body: UpdateEmailReminderStatusInput,
  ) {
    const r = await this.reminders.updateEmailReminderStatus(user.id, id, body.status);
    return ok(toEmailReminderDto(r), 'Updated');
  }

  @Delete('email-reminders/:id')
  @HttpCode(204)
  async deleteEmailReminder(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.reminders.deleteEmailReminder(user.id, id);
  }

  // ---- Message reminders ---------------------------------------------------

  @Get('message-reminders')
  async listMessageReminders(@CurrentUser() user: AuthUser) {
    const rows = await this.reminders.listMessageReminders(user.id);
    return ok(rows.map(toMessageReminderDto), 'OK');
  }

  @Post('message-reminders')
  async createMessageReminder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateMessageReminderSchema))
    body: CreateMessageReminderInput,
  ) {
    const r = await this.reminders.createMessageReminder(user.id, body);
    return ok(toMessageReminderDto(r), 'Created');
  }

  @Patch('message-reminders/:id/status')
  async patchMessageReminder(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateMessageReminderStatusSchema))
    body: UpdateMessageReminderStatusInput,
  ) {
    const r = await this.reminders.updateMessageReminderStatus(user.id, id, body.status);
    return ok(toMessageReminderDto(r), 'Updated');
  }

  @Delete('message-reminders/:id')
  @HttpCode(204)
  async deleteMessageReminder(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.reminders.deleteMessageReminder(user.id, id);
  }

  // ---- AI memory -----------------------------------------------------------

  @Get('ai-memory')
  async listMemory(@CurrentUser() user: AuthUser) {
    const rows = await this.memory.list(user.id);
    return ok(rows.map(toCompanionMemoryDto), 'OK');
  }

  @Post('ai-memory')
  async createMemory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateAiCompanionMemorySchema))
    body: CreateAiCompanionMemoryInput,
  ) {
    // Source `USER_CONFIRMATION` implies the user explicitly clicked
    // "remember this" — it's the single allowed path for sensitive types.
    const userConfirmed = body.source === 'USER_CONFIRMATION';
    const r = await this.memory.create(user.id, body, userConfirmed);
    return ok(toCompanionMemoryDto(r), 'Created');
  }

  @Patch('ai-memory/:id')
  async updateMemory(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateAiCompanionMemorySchema))
    body: UpdateAiCompanionMemoryInput,
  ) {
    return ok(
      toCompanionMemoryDto(await this.memory.update(user.id, id, body)),
      'Updated',
    );
  }

  @Delete('ai-memory/:id')
  @HttpCode(204)
  async deleteMemory(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.memory.delete(user.id, id);
  }

  @Post('ai-memory/clear')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async clearMemory(@CurrentUser() user: AuthUser) {
    return ok(await this.memory.clearAll(user.id), 'Cleared');
  }

  @Get('ai-memory/consent')
  async getConsent(@CurrentUser() user: AuthUser) {
    return ok(toMemoryConsentDto(await this.settings.getMemoryConsent(user.id)), 'OK');
  }

  @Put('ai-memory/consent')
  async putConsent(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateMemoryConsentSchema)) body: UpdateMemoryConsentInput,
  ) {
    return ok(
      toMemoryConsentDto(await this.settings.updateMemoryConsent(user.id, body)),
      'Updated',
    );
  }
}

// Suppress unused-import warning when ConnectedAccountProviderSchema isn't
// referenced directly from this file (kept as a re-export anchor for tests).
void ConnectedAccountProviderSchema;
