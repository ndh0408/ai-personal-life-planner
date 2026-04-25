import {
  BadRequestException,
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
  ConfirmSuggestedActionSchema,
  ParseQuickCaptureSchema,
  QuickMealLogSchema,
  QuickMoodLogSchema,
  QuickSleepLogSchema,
  TranscribeRequestSchema,
  UpdateHealthIntegrationSchema,
  UpdateSmartCheckinSettingsSchema,
  type ConfirmSuggestedActionInput,
  type ParseQuickCaptureInput,
  type QuickMealLogInput,
  type QuickMoodLogInput,
  type QuickSleepLogInput,
  type TranscribeRequestInput,
  type UpdateHealthIntegrationInput,
  type UpdateSmartCheckinSettingsInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { SmartCheckinSettingsService } from './smart-checkin-settings.service';
import { HealthIntegrationService } from './health-integration.service';
import { QuickCaptureService } from './quick-capture.service';
import { SpeechToTextService } from './speech-to-text.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { SleepLogsService } from '../sleep-logs/sleep-logs.service';
import { MoodLogsService } from '../mood-logs/mood-logs.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CompanionMemoryService } from '../communication/companion-memory.service';
import {
  toHealthIntegrationDto,
  toSmartCheckinSettingsDto,
  toSuggestedActionDto,
} from './dto';

/**
 * Voice Companion + Smart Check-in surface.
 *
 * The /voice/transcribe endpoint is a no-op stub today (returns
 * notImplemented:true) — STT lands in v1.3. Mobile uses the same shape so
 * the contract is stable.
 *
 * /ai/parse-quick-capture is the heart of the feature: a transcript in,
 * 0-5 PENDING SuggestedAction rows out. Mobile shows them in
 * SuggestedActionsReviewModal; the user confirms each, and only then the
 * matching downstream entity is created via the existing modules.
 */
@Controller()
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class VoiceCompanionController {
  constructor(
    private readonly checkinSettings: SmartCheckinSettingsService,
    private readonly healthIntegration: HealthIntegrationService,
    private readonly quickCapture: QuickCaptureService,
    private readonly stt: SpeechToTextService,
    private readonly mealLogs: MealLogsService,
    private readonly sleepLogs: SleepLogsService,
    private readonly moodLogs: MoodLogsService,
    private readonly expenses: ExpensesService,
    private readonly memory: CompanionMemoryService,
  ) {}

  // ---- Smart check-in settings ---------------------------------------------

  @Get('smart-checkins/settings')
  async getCheckinSettings(@CurrentUser() user: AuthUser) {
    return ok(toSmartCheckinSettingsDto(await this.checkinSettings.get(user.id)), 'OK');
  }

  @Put('smart-checkins/settings')
  async updateCheckinSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateSmartCheckinSettingsSchema))
    body: UpdateSmartCheckinSettingsInput,
  ) {
    return ok(
      toSmartCheckinSettingsDto(await this.checkinSettings.update(user.id, body)),
      'Updated',
    );
  }

  // ---- Health integration --------------------------------------------------

  @Get('health-integration/settings')
  async getHealth(@CurrentUser() user: AuthUser) {
    return ok(toHealthIntegrationDto(await this.healthIntegration.get(user.id)), 'OK');
  }

  @Put('health-integration/settings')
  async updateHealth(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateHealthIntegrationSchema))
    body: UpdateHealthIntegrationInput,
  ) {
    return ok(toHealthIntegrationDto(await this.healthIntegration.update(user.id, body)), 'Updated');
  }

  // ---- Speech-to-text (v1.2 stub) ------------------------------------------

  @Post('voice/transcribe')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async transcribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(TranscribeRequestSchema)) body: TranscribeRequestInput,
  ) {
    return ok(await this.stt.transcribe(user.id, body), 'Transcribed');
  }

  // ---- Quick capture parser ------------------------------------------------

  @Post('ai/parse-quick-capture')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async parseQuickCapture(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ParseQuickCaptureSchema)) body: ParseQuickCaptureInput,
  ) {
    return ok(await this.quickCapture.parse(user.id, body), 'Parsed');
  }

  @Get('suggested-actions/pending')
  async listPending(@CurrentUser() user: AuthUser) {
    return ok(await this.quickCapture.listPending(user.id), 'OK');
  }

  /**
   * Single confirm endpoint. Resolves the action's type, calls the matching
   * existing service to create the downstream row, then marks the suggested
   * action CONFIRMED with the new row's id pinned for traceability.
   */
  @Post('suggested-actions/:id/confirm')
  async confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ConfirmSuggestedActionSchema))
    body: ConfirmSuggestedActionInput,
  ) {
    const pending = await this.quickCapture.listPending(user.id);
    const found = pending.find((a) => a.id === id);
    if (!found) {
      throw new BadRequestException({
        message: 'Suggested action not pending',
        errorCode: 'NOT_FOUND',
      });
    }
    const payload = { ...found.payload, ...(body.payloadOverride ?? {}) } as Record<
      string,
      unknown
    >;
    let appliedRefId: string | null = null;
    let appliedRefKind: string | null = null;

    switch (found.type) {
      case 'ADD_MEAL_LOG': {
        const created = await this.mealLogs.create(user.id, {
          date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
          mealType: payload.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK',
          title: String(payload.title ?? found.title).slice(0, 200),
          estimatedCalories:
            typeof payload.estimatedCalories === 'number' ? payload.estimatedCalories : undefined,
          cost: typeof payload.estimatedCost === 'number' ? payload.estimatedCost : undefined,
          note: typeof payload.note === 'string' ? payload.note : undefined,
        } as never);
        appliedRefId = created.id;
        appliedRefKind = 'meal_log';
        break;
      }
      case 'ADD_SLEEP_LOG': {
        const created = await this.sleepLogs.create(user.id, {
          date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
          sleepTime: String(payload.sleepTime),
          wakeTime: String(payload.wakeTime),
          quality: (payload.quality as never) ?? 'NORMAL',
          note: typeof payload.note === 'string' ? payload.note : undefined,
        } as never);
        appliedRefId = created.id;
        appliedRefKind = 'sleep_log';
        break;
      }
      case 'ADD_MOOD_LOG': {
        const created = await this.moodLogs.create(user.id, {
          date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
          mood: payload.mood as never,
          energyLevel: (payload.energyLevel as never) ?? 'MEDIUM',
          stressLevel: (payload.stressLevel as never) ?? 'MEDIUM',
          note: typeof payload.note === 'string' ? payload.note : undefined,
        } as never);
        appliedRefId = created.id;
        appliedRefKind = 'mood_log';
        break;
      }
      case 'ADD_EXPENSE': {
        const created = await this.expenses.create(user.id, {
          title: String(payload.title ?? found.title).slice(0, 200),
          amount: Number(payload.amount ?? 0),
          category: String(payload.category ?? 'other'),
          expenseDate: String(payload.expenseDate ?? new Date().toISOString().slice(0, 10)),
          walletId: typeof payload.walletId === 'string' ? payload.walletId : undefined,
          note: typeof payload.note === 'string' ? payload.note : undefined,
        });
        appliedRefId = created.id;
        appliedRefKind = 'expense';
        break;
      }
      case 'SAVE_MEMORY': {
        const created = await this.memory.create(
          user.id,
          {
            memoryType: (payload.memoryType as never) ?? 'OTHER',
            content: String(payload.content ?? found.title).slice(0, 600),
            source: 'USER_CONFIRMATION',
          },
          true,
        );
        appliedRefId = created.id;
        appliedRefKind = 'ai_companion_memory';
        break;
      }
      case 'ASK_FOLLOWUP':
        // No row created — confirmation just dismisses the prompt.
        break;
      default:
        // ADD_TASK / ADD_INCOME / CREATE_REMINDER / GENERATE_SCHEDULE /
        // RESCHEDULE_TODAY are recognised types but their downstream
        // services aren't wired through here yet. Mark as CONFIRMED
        // without an applied row so the mobile UI can short-circuit and
        // open the matching dedicated screen pre-filled.
        break;
    }

    const row = await this.quickCapture.markConfirmed(user.id, id, appliedRefId, appliedRefKind);
    return ok(row, 'Confirmed');
  }

  @Post('suggested-actions/:id/reject')
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return ok(await this.quickCapture.reject(user.id, id), 'Rejected');
  }

  // ---- Quick logs (manual) -------------------------------------------------
  // Thin wrappers around the existing module services so the mobile
  // QuickLog screens have a single endpoint per flow.

  @Post('meal-logs/quick')
  async quickMealLog(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QuickMealLogSchema)) body: QuickMealLogInput,
  ) {
    const created = await this.mealLogs.create(user.id, {
      date: body.date,
      mealType: body.mealType,
      title: body.title,
      estimatedCalories: body.estimatedCalories,
      cost: body.estimatedCost,
      note: body.note,
    } as never);

    let expense = null;
    if (body.alsoCreateExpense && body.estimatedCost && body.estimatedCost > 0) {
      expense = await this.expenses.create(user.id, {
        title: body.title,
        amount: body.estimatedCost,
        category: 'food',
        expenseDate: body.date,
        walletId: body.walletId ?? undefined,
        note: body.note,
      });
    }
    return ok({ mealLog: created, expense }, 'Saved');
  }

  @Post('sleep-logs/quick')
  async quickSleepLog(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QuickSleepLogSchema)) body: QuickSleepLogInput,
  ) {
    return ok(
      await this.sleepLogs.create(user.id, {
        date: body.date,
        sleepTime: body.sleepTime,
        wakeTime: body.wakeTime,
        quality: body.quality ?? 'NORMAL',
        note: body.note,
      } as never),
      'Saved',
    );
  }

  @Post('mood-logs/quick')
  async quickMoodLog(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QuickMoodLogSchema)) body: QuickMoodLogInput,
  ) {
    return ok(
      await this.moodLogs.create(user.id, {
        date: body.date,
        mood: body.mood,
        energyLevel: body.energyLevel ?? 'MEDIUM',
        stressLevel: body.stressLevel ?? 'MEDIUM',
        note: body.note,
      } as never),
      'Saved',
    );
  }

  // suppress unused import warning
  @Get('voice-companion/_healthz')
  @HttpCode(204)
  noop() {
    void toSuggestedActionDto;
  }
}
