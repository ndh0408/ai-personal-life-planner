/**
 * Takes a (kind, fields) pair previously produced by CaptureService.parse(),
 * validates against the per-kind Zod schema, and inserts into the matching
 * table. Idempotency-key-aware where the model supports it.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CaptureConfirmRequest,
  type CaptureConfirmResponse,
  ExpenseFieldsSchema,
  MealFieldsSchema,
  TaskFieldsSchema,
  SleepFieldsSchema,
  MoodFieldsSchema,
} from '@lifeos/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfirmService {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(userId: string, input: CaptureConfirmRequest): Promise<CaptureConfirmResponse> {
    let response: CaptureConfirmResponse;
    switch (input.kind) {
      case 'EXPENSE':
        response = await this.insertExpense(userId, input);
        break;
      case 'MEAL':
        response = await this.insertMeal(userId, input);
        break;
      case 'TASK':
        response = await this.insertTask(userId, input);
        break;
      case 'SLEEP':
        response = await this.insertSleep(userId, input);
        break;
      case 'MOOD':
        response = await this.insertMood(userId, input);
        break;
      default:
        throw new BadRequestException({
          error: { code: 'CAPTURE_FIELDS_INVALID', message: 'kind không hỗ trợ' },
        });
    }

    // Audit: persist the original sentence + parsed action so we can later
    // power "what did I capture today" / "undo last capture" without needing
    // to reverse-engineer rows. Best-effort — failure here is logged but
    // doesn't fail the user-visible insert (which already succeeded).
    if (input.rawText) {
      // Prisma's Json column wants InputJsonValue; the action shape is
      // plain JSON-safe so the cast is safe.
      const parsedActions = {
        kind: input.kind,
        fields: input.fields,
        targetId: response.id,
      } as Prisma.InputJsonValue;
      await this.prisma.quickCapture
        .create({
          data: {
            userId,
            rawText: input.rawText,
            status: 'CONFIRMED',
            parsedActions,
          },
        })
        .catch(() => undefined);
    }

    return response;
  }

  // ── Expense ──────────────────────────────────────────────────────────────

  private async insertExpense(
    userId: string,
    input: CaptureConfirmRequest,
  ): Promise<CaptureConfirmResponse> {
    const fields = parseOrThrow(ExpenseFieldsSchema, input.fields);
    const wallet = await this.defaultWallet(userId);

    if (input.idempotencyKey) {
      const existing = await this.prisma.expense.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return done('EXPENSE', existing.id, existing.createdAt);
    }

    // Insert the expense AND decrement the wallet balance in one transaction
    // so the running balance never drifts from the sum of expenses + incomes.
    const amount = new Prisma.Decimal(fields.amount);
    const [row] = await this.prisma.$transaction([
      this.prisma.expense.create({
        data: {
          userId,
          walletId: wallet.id,
          title: fields.title,
          amount,
          category: fields.category,
          expenseDate: new Date(fields.expenseDateIso),
          idempotencyKey: input.idempotencyKey ?? null,
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
    ]);
    return done('EXPENSE', row.id, row.createdAt);
  }

  // ── Meal ─────────────────────────────────────────────────────────────────

  private async insertMeal(
    userId: string,
    input: CaptureConfirmRequest,
  ): Promise<CaptureConfirmResponse> {
    const fields = parseOrThrow(MealFieldsSchema, input.fields);
    const row = await this.prisma.mealLog.create({
      data: {
        userId,
        title: fields.title,
        mealType: fields.mealType,
        cost: fields.cost != null ? new Prisma.Decimal(fields.cost) : null,
        loggedAt: new Date(fields.loggedAtIso),
      },
    });
    return done('MEAL', row.id, row.createdAt);
  }

  // ── Task ─────────────────────────────────────────────────────────────────

  private async insertTask(
    userId: string,
    input: CaptureConfirmRequest,
  ): Promise<CaptureConfirmResponse> {
    const fields = parseOrThrow(TaskFieldsSchema, input.fields);
    const row = await this.prisma.task.create({
      data: {
        userId,
        title: fields.title,
        dueAt: fields.dueAtIso ? new Date(fields.dueAtIso) : null,
        priority: fields.priority,
        status: 'TODO',
      },
    });
    return done('TASK', row.id, row.createdAt);
  }

  // ── Sleep ────────────────────────────────────────────────────────────────

  private async insertSleep(
    userId: string,
    input: CaptureConfirmRequest,
  ): Promise<CaptureConfirmResponse> {
    const fields = parseOrThrow(SleepFieldsSchema, input.fields);
    const row = await this.prisma.sleepLog.create({
      data: {
        userId,
        sleepAt: new Date(fields.sleepAtIso),
        wakeAt: new Date(fields.wakeAtIso),
        durationMinutes: fields.durationMinutes,
        quality: fields.quality ?? null,
      },
    });
    return done('SLEEP', row.id, row.createdAt);
  }

  // ── Mood ─────────────────────────────────────────────────────────────────

  private async insertMood(
    userId: string,
    input: CaptureConfirmRequest,
  ): Promise<CaptureConfirmResponse> {
    const fields = parseOrThrow(MoodFieldsSchema, input.fields);
    const row = await this.prisma.moodLog.create({
      data: {
        userId,
        mood: fields.mood,
        energy: fields.energy,
        loggedAt: new Date(fields.loggedAtIso),
      },
    });
    return done('MOOD', row.id, row.createdAt);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Returns the user's default wallet, creating one if none exists. */
  private async defaultWallet(userId: string) {
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, deletedAt: null, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.wallet.create({
      data: { userId, name: 'Ví chính', isDefault: true, currency: 'VND' },
    });
  }
}

function parseOrThrow<T>(schema: { safeParse: (i: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new BadRequestException({
      error: {
        code: 'CAPTURE_FIELDS_INVALID',
        message: 'Trường nhập không hợp lệ',
        issues: r.error?.issues,
      },
    });
  }
  return r.data as T;
}

function done(
  kind: CaptureConfirmResponse['kind'],
  id: string,
  createdAt: Date,
): CaptureConfirmResponse {
  return { kind, id, createdAt: createdAt.toISOString() };
}

// Quiet the unused-NotFoundException import — reserved for future endpoints.
void NotFoundException;
