/**
 * Undo a capture confirm (round 22).
 *
 * The contract: any QuickCapture row that's been applied (status=CONFIRMED,
 * appliedEntityId set, undoneAt null) can be reversed inside one transaction.
 * For finance kinds we re-credit/debit the wallet so the running balance
 * stays consistent with the sum of expenses + incomes; for everything else
 * we soft-delete (where the table supports it) or hard-delete (when there
 * is no soft-delete column — sleep, mood, meal logs).
 *
 * Idempotency: a second undo on the same QuickCapture is rejected as
 * `CAPTURE_ALREADY_UNDONE` rather than re-running the reversal, so a
 * double-tap on the snackbar can't double-credit a wallet.
 *
 * Window: the mobile UI only shows the Hoàn tác button while
 * `undoAvailableUntil` is in the future. The server still accepts undo
 * after that timestamp — the window is a UX guideline, not a security
 * boundary; the user owns the data either way.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../intelligence/event-log.service';
import { UserContextService } from '../intelligence/user-context.service';

export interface UndoResult {
  quickCaptureId: string;
  reversedEntityType: string;
  reversedEntityId: string;
}

@Injectable()
export class UndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventLogService,
    private readonly userCtx: UserContextService,
  ) {}

  async undo(userId: string, quickCaptureId: string, reason?: string): Promise<UndoResult> {
    const qc = await this.prisma.quickCapture.findUnique({ where: { id: quickCaptureId } });
    if (!qc) {
      throw new NotFoundException({
        error: { code: 'CAPTURE_NOT_FOUND', message: 'Không tìm thấy bản ghi cần hoàn tác.' },
      });
    }
    if (qc.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Bạn không có quyền với bản ghi này.' },
      });
    }
    if (qc.undoneAt) {
      throw new BadRequestException({
        error: { code: 'CAPTURE_ALREADY_UNDONE', message: 'Bản ghi này đã được hoàn tác.' },
      });
    }
    if (!qc.appliedEntityType || !qc.appliedEntityId) {
      throw new BadRequestException({
        error: { code: 'CAPTURE_NOT_APPLIED', message: 'Không có thực thể nào để hoàn tác.' },
      });
    }

    const entityType = qc.appliedEntityType;
    const entityId = qc.appliedEntityId;

    await this.prisma.$transaction(async (tx) => {
      switch (entityType) {
        case 'EXPENSE':
          await this.reverseExpense(tx, userId, entityId);
          break;
        case 'INCOME':
          await this.reverseIncome(tx, userId, entityId);
          break;
        case 'TASK':
          await tx.task.updateMany({
            where: { id: entityId, userId, deletedAt: null },
            data: { deletedAt: new Date(), status: 'CANCELLED' },
          });
          break;
        case 'MEAL':
          await tx.mealLog.deleteMany({ where: { id: entityId, userId } });
          break;
        case 'SLEEP':
          await tx.sleepLog.deleteMany({ where: { id: entityId, userId } });
          break;
        case 'MOOD':
          await tx.moodLog.deleteMany({ where: { id: entityId, userId } });
          break;
        default:
          throw new BadRequestException({
            error: {
              code: 'CAPTURE_KIND_UNSUPPORTED',
              message: `Không hỗ trợ hoàn tác cho ${entityType}.`,
            },
          });
      }

      await tx.quickCapture.update({
        where: { id: quickCaptureId },
        data: {
          undoneAt: new Date(),
          undoReason: reason ?? null,
          status: 'CANCELLED',
        },
      });
    });

    // Best-effort post-tx side effects: log + invalidate snapshot. A failure
    // here doesn't break the user-visible undo (data has already reversed).
    await this.events
      .log(userId, 'CAPTURE_UNDONE', `Undone ${entityType}`, {
        quickCaptureId,
        entityType,
        entityId,
      })
      .catch(() => undefined);
    await this.userCtx.invalidate(userId);

    return {
      quickCaptureId,
      reversedEntityType: entityType,
      reversedEntityId: entityId,
    };
  }

  private async reverseExpense(tx: Prisma.TransactionClient, userId: string, expenseId: string) {
    const exp = await tx.expense.findFirst({ where: { id: expenseId, userId, deletedAt: null } });
    if (!exp) return; // already gone — treat as no-op (idempotent)
    await tx.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });
    // Re-credit the wallet by the same amount we debited at confirm time.
    await tx.wallet.update({
      where: { id: exp.walletId },
      data: { balance: { increment: exp.amount } },
    });
  }

  private async reverseIncome(tx: Prisma.TransactionClient, userId: string, incomeId: string) {
    const inc = await tx.income.findFirst({ where: { id: incomeId, userId, deletedAt: null } });
    if (!inc) return;
    await tx.income.update({
      where: { id: incomeId },
      data: { deletedAt: new Date() },
    });
    await tx.wallet.update({
      where: { id: inc.walletId },
      data: { balance: { decrement: inc.amount } },
    });
  }
}
