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
    switch (input.kind) {
      case 'EXPENSE':
        return this.insertExpense(userId, input);
      case 'MEAL':
        return this.insertMeal(userId, input);
      case 'TASK':
        return this.insertTask(userId, input);
      case 'SLEEP':
        return this.insertSleep(userId, input);
      case 'MOOD':
        return this.insertMood(userId, input);
      default:
        throw new BadRequestException({
          error: { code: 'CAPTURE_FIELDS_INVALID', message: 'kind không hỗ trợ' },
        });
    }
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

    const row = await this.prisma.expense.create({
      data: {
        userId,
        walletId: wallet.id,
        title: fields.title,
        amount: new Prisma.Decimal(fields.amount),
        category: fields.category,
        expenseDate: new Date(fields.expenseDateIso),
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
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
