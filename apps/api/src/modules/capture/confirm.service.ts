/**
 * Confirm a parsed capture and write the underlying entity.
 *
 * Round 21 contract:
 *   - The QuickCapture audit row is created **inside the same transaction**
 *     as the entity it spawned, with full parse provenance + applied refs.
 *     This makes undo (round 22) deterministic — the audit row knows exactly
 *     what to reverse.
 *   - If `originalKind` / `originalFields` are present and differ from the
 *     final kind / fields, a CaptureCorrection row is appended (post-tx) so
 *     the OpenAI parser can pick it up as a few-shot example next time.
 *   - The response carries `quickCaptureId` + `undoAvailableUntil` so the
 *     mobile snackbar can offer a Hoàn tác button. Older clients that don't
 *     read those fields keep working — the schema marks them optional.
 *
 * Caveat: idempotency check (round 15) still runs first; a duplicate confirm
 * returns the existing row without creating a new QuickCapture, since there
 * is nothing new to undo.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type CaptureConfirmRequest,
  type CaptureConfirmResponse,
  ExpenseFieldsSchema,
  IncomeFieldsSchema,
  MealFieldsSchema,
  TaskFieldsSchema,
  SleepFieldsSchema,
  MoodFieldsSchema,
} from '@lifeos/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../intelligence/event-log.service';
import { BehaviorService } from '../intelligence/behavior.service';
import { UserContextService } from '../intelligence/user-context.service';
import { CorrectionsService } from './corrections.service';

const UNDO_WINDOW_SECONDS = 60;

type CaptureKindStr = CaptureConfirmRequest['kind'];

interface InsertResult {
  entityId: string;
  entityCreatedAt: Date;
  quickCaptureId: string;
}

@Injectable()
export class ConfirmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventLogService,
    private readonly behavior: BehaviorService,
    private readonly userCtx: UserContextService,
    private readonly corrections: CorrectionsService,
  ) {}

  async confirm(userId: string, input: CaptureConfirmRequest): Promise<CaptureConfirmResponse> {
    let result: InsertResult;
    switch (input.kind) {
      case 'EXPENSE':
        result = await this.insertExpense(userId, input);
        break;
      case 'INCOME':
        result = await this.insertIncome(userId, input);
        break;
      case 'MEAL':
        result = await this.insertMeal(userId, input);
        break;
      case 'TASK':
        result = await this.insertTask(userId, input);
        break;
      case 'SLEEP':
        result = await this.insertSleep(userId, input);
        break;
      case 'MOOD':
        result = await this.insertMood(userId, input);
        break;
      default:
        throw new BadRequestException({
          error: { code: 'CAPTURE_FIELDS_INVALID', message: 'kind không hỗ trợ' },
        });
    }

    // Persist the user's correction (if any) outside the transaction. We
    // don't fail the confirm if this fails; the entity already exists.
    if (this.isCorrection(input)) {
      await this.corrections
        .record({
          userId,
          quickCaptureId: result.quickCaptureId,
          rawText: input.rawText ?? '',
          originalSource: mapSource(input.parseSource),
          originalKind: input.originalKind ?? null,
          originalConfidence: input.parseConfidence ?? null,
          originalPayload: input.originalFields ?? null,
          correctedKind: input.kind,
          correctedPayload: input.fields,
        })
        .catch(() => undefined);
    }

    // EventLog feeds the assistant the rolling "what just happened" stream.
    const summaryText = (input.rawText ?? input.kind).slice(0, 280);
    await this.events.log(userId, 'CAPTURE_CONFIRMED', summaryText, {
      kind: input.kind,
      targetId: result.entityId,
      quickCaptureId: result.quickCaptureId,
    });
    if (input.kind === 'SLEEP' || input.kind === 'EXPENSE' || input.kind === 'INCOME') {
      void this.behavior.recompute(userId).catch(() => undefined);
    }

    // Drop the snapshot cache so the next AI call sees the new row instead
    // of waiting for the 60 s TTL to elapse.
    await this.userCtx.invalidate(userId);

    const undoUntil = new Date(result.entityCreatedAt.getTime() + UNDO_WINDOW_SECONDS * 1000);
    return {
      kind: input.kind,
      id: result.entityId,
      createdAt: result.entityCreatedAt.toISOString(),
      quickCaptureId: result.quickCaptureId,
      undoAvailableUntil: undoUntil.toISOString(),
    };
  }

  // ── Per-kind inserts ─────────────────────────────────────────────────────

  private async insertExpense(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(ExpenseFieldsSchema, input.fields);

    if (input.idempotencyKey) {
      const existing = await this.prisma.expense.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        // Idempotent retry — find the QuickCapture we created the first time.
        const qc = await this.findQc(userId, 'EXPENSE', existing.id);
        return { entityId: existing.id, entityCreatedAt: existing.createdAt, quickCaptureId: qc };
      }
    }

    const wallet = await this.defaultWallet(userId);
    const amount = new Prisma.Decimal(fields.amount);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          userId,
          walletId: wallet.id,
          title: fields.title,
          amount,
          category: fields.category,
          expenseDate: new Date(fields.expenseDateIso),
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });
      const qc = await this.writeQc(tx, userId, input, 'EXPENSE', expense.id);
      return { entityId: expense.id, entityCreatedAt: expense.createdAt, quickCaptureId: qc.id };
    });
  }

  private async insertIncome(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(IncomeFieldsSchema, input.fields);

    if (input.idempotencyKey) {
      const existing = await this.prisma.income.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        const qc = await this.findQc(userId, 'INCOME', existing.id);
        return { entityId: existing.id, entityCreatedAt: existing.createdAt, quickCaptureId: qc };
      }
    }

    const wallet = await this.defaultWallet(userId);
    const amount = new Prisma.Decimal(fields.amount);

    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          userId,
          walletId: wallet.id,
          title: fields.title,
          amount,
          category: fields.category,
          incomeDate: new Date(fields.incomeDateIso),
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      const qc = await this.writeQc(tx, userId, input, 'INCOME', income.id);
      return { entityId: income.id, entityCreatedAt: income.createdAt, quickCaptureId: qc.id };
    });
  }

  private async insertMeal(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(MealFieldsSchema, input.fields);
    return this.prisma.$transaction(async (tx) => {
      const meal = await tx.mealLog.create({
        data: {
          userId,
          title: fields.title,
          mealType: fields.mealType,
          cost: fields.cost != null ? new Prisma.Decimal(fields.cost) : null,
          loggedAt: new Date(fields.loggedAtIso),
        },
      });
      const qc = await this.writeQc(tx, userId, input, 'MEAL', meal.id);
      return { entityId: meal.id, entityCreatedAt: meal.createdAt, quickCaptureId: qc.id };
    });
  }

  private async insertTask(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(TaskFieldsSchema, input.fields);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId,
          title: fields.title,
          dueAt: fields.dueAtIso ? new Date(fields.dueAtIso) : null,
          priority: fields.priority,
          status: 'TODO',
        },
      });
      const qc = await this.writeQc(tx, userId, input, 'TASK', task.id);
      return { entityId: task.id, entityCreatedAt: task.createdAt, quickCaptureId: qc.id };
    });
  }

  private async insertSleep(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(SleepFieldsSchema, input.fields);
    return this.prisma.$transaction(async (tx) => {
      const sleep = await tx.sleepLog.create({
        data: {
          userId,
          sleepAt: new Date(fields.sleepAtIso),
          wakeAt: new Date(fields.wakeAtIso),
          durationMinutes: fields.durationMinutes,
          quality: fields.quality ?? null,
        },
      });
      const qc = await this.writeQc(tx, userId, input, 'SLEEP', sleep.id);
      return { entityId: sleep.id, entityCreatedAt: sleep.createdAt, quickCaptureId: qc.id };
    });
  }

  private async insertMood(userId: string, input: CaptureConfirmRequest): Promise<InsertResult> {
    const fields = parseOrThrow(MoodFieldsSchema, input.fields);
    return this.prisma.$transaction(async (tx) => {
      const mood = await tx.moodLog.create({
        data: {
          userId,
          mood: fields.mood,
          energy: fields.energy,
          loggedAt: new Date(fields.loggedAtIso),
        },
      });
      const qc = await this.writeQc(tx, userId, input, 'MOOD', mood.id);
      return { entityId: mood.id, entityCreatedAt: mood.createdAt, quickCaptureId: qc.id };
    });
  }

  // ── QuickCapture audit + lookup helpers ──────────────────────────────────

  private async writeQc(
    tx: Prisma.TransactionClient,
    userId: string,
    input: CaptureConfirmRequest,
    kind: CaptureKindStr,
    entityId: string,
  ) {
    const parseSource = mapSource(input.parseSource);
    const parsedActions = {
      kind: input.kind,
      fields: input.fields,
      targetId: entityId,
      originalKind: input.originalKind,
      originalFields: input.originalFields,
    } as Prisma.InputJsonValue;
    return tx.quickCapture.create({
      data: {
        userId,
        rawText: input.rawText ?? '',
        status: 'CONFIRMED',
        parsedActions,
        parseSource,
        parseConfidence:
          input.parseConfidence != null ? new Prisma.Decimal(input.parseConfidence) : null,
        parseNeedsReview: input.parseConfidence != null && input.parseConfidence < 0.55,
        parsedKind: input.originalKind ?? input.kind,
        parsedPayload: (input.originalFields ?? input.fields) as Prisma.InputJsonValue,
        finalKind: input.kind,
        finalPayload: input.fields as Prisma.InputJsonValue,
        appliedEntityType: kind,
        appliedEntityId: entityId,
        appliedAt: new Date(),
      },
    });
  }

  /** Locate the QuickCapture row that was written when this entity was first
   *  confirmed (for idempotent retries). Throws to surface the inconsistency
   *  if missing — callers expect a real id back. */
  private async findQc(userId: string, kind: CaptureKindStr, entityId: string): Promise<string> {
    const qc = await this.prisma.quickCapture.findFirst({
      where: { userId, appliedEntityType: kind, appliedEntityId: entityId },
      orderBy: { createdAt: 'desc' },
    });
    if (qc) return qc.id;
    // Pre-R21 rows didn't carry applied refs. Stamp a fresh QuickCapture so
    // the response still has a handle (undo just won't work for the legacy row).
    const created = await this.prisma.quickCapture.create({
      data: {
        userId,
        rawText: '',
        status: 'CONFIRMED',
        parsedActions: { kind, targetId: entityId } as Prisma.InputJsonValue,
        appliedEntityType: kind,
        appliedEntityId: entityId,
        appliedAt: new Date(),
      },
    });
    return created.id;
  }

  // ── Correction detection ─────────────────────────────────────────────────

  /** True iff the user actually changed something between parse and confirm. */
  private isCorrection(input: CaptureConfirmRequest): boolean {
    if (!input.originalKind && !input.originalFields) return false;
    if (input.originalKind && input.originalKind !== input.kind) return true;
    if (input.originalFields && JSON.stringify(input.originalFields) !== JSON.stringify(input.fields)) {
      return true;
    }
    return false;
  }

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

function mapSource(s: CaptureConfirmRequest['parseSource'] | undefined): 'RULE' | 'LLM' | 'HYBRID' | 'MANUAL' {
  if (!s) return 'MANUAL';
  if (s === 'OPENAI') return 'LLM';
  return s;
}

function parseOrThrow<T>(
  schema: { safeParse: (i: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } },
  input: unknown,
): T {
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
