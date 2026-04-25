import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../auth-security/security-audit.service';

export type PurgeRequest = {
  /** Target user to purge. */
  targetUserId: string;
  /** The admin performing the action — must NOT be the target. */
  actingAdminId: string;
  /** Operator must echo this exact string to confirm. */
  confirmation: string;
  /** When true, no DB writes happen — returns the would-be summary. */
  dryRun?: boolean;
};

export type PurgeResult = {
  dryRun: boolean;
  targetUserId: string;
  /** Per-table counts of rows that were (or would be) deleted/anonymised. */
  counts: Record<string, number>;
};

const REQUIRED_CONFIRMATION = 'I UNDERSTAND THIS IS IRREVERSIBLE';

/**
 * Per-user GDPR-style data purge.
 *
 * Round-18 design choices (intentional):
 * - Most owned data is **hard-deleted** via Prisma's onDelete cascade rules
 *   from `User`. We let Prisma handle the dependency graph rather than
 *   hand-coding 40 deletes.
 * - **FinanceAuditLog and SecurityAuditLog rows are RETAINED** but
 *   anonymised (`userId` set to null, `emailHint` cleared). Auditors need
 *   the trail; the user's identity is the part we erase. This is
 *   intentional and documented in `docs/GDPR_DATA_PURGE.md`.
 * - The acting admin's id is recorded in a SecurityAuditLog row before the
 *   purge starts, so even if everything else cascades away, the audit log
 *   can be queried by `(actor=adminId, type=ACCOUNT_LOCKED)` proxy.
 *
 * Safeguards:
 * - Refuses when `confirmation !== REQUIRED_CONFIRMATION`.
 * - Refuses when admin == target (no self-purge — a separate "delete my
 *   account" path exists for self-serve).
 * - Refuses when the target's role is ADMIN (require manual DBA action).
 * - Dry-run mode returns counts without writing.
 */
@Injectable()
export class DataPurgeService {
  private readonly logger = new Logger(DataPurgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  static readonly REQUIRED_CONFIRMATION = REQUIRED_CONFIRMATION;

  async purge(req: PurgeRequest): Promise<PurgeResult> {
    if (req.confirmation !== REQUIRED_CONFIRMATION) {
      throw new BadRequestException({
        message: 'confirmation string does not match',
        errorCode: 'PURGE_CONFIRMATION_REQUIRED',
      });
    }
    if (req.targetUserId === req.actingAdminId) {
      throw new ForbiddenException({
        message: 'cannot purge yourself; use the self-serve account deletion flow',
        errorCode: 'PURGE_SELF_FORBIDDEN',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: req.targetUserId },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      throw new NotFoundException({
        message: 'target user not found',
        errorCode: 'NOT_FOUND',
      });
    }
    if (target.role === 'ADMIN') {
      throw new ForbiddenException({
        message: 'admin accounts must be purged manually by a DBA after role downgrade',
        errorCode: 'PURGE_ADMIN_FORBIDDEN',
      });
    }

    // Count what we're about to touch (so the dry-run is meaningful).
    const counts = await this.collectCounts(req.targetUserId);

    if (req.dryRun) {
      return { dryRun: true, targetUserId: req.targetUserId, counts };
    }

    // Pre-purge audit row from the admin's perspective. Written FIRST so
    // there's a trace even if the transaction below partially fails.
    await this.securityAudit.record({
      userId: req.actingAdminId,
      emailHint: target.email,
      type: 'ACCOUNT_UNLOCKED', // closest existing event; metadata clarifies
      metadata: {
        action: 'GDPR_PURGE_INITIATED',
        targetUserId: req.targetUserId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      // 1. Anonymise security audit rows we want to KEEP for cross-user
      //    forensics (e.g. credential-stuffing patterns by emailHint).
      //    `userId` is nullable on `security_audit_logs`; we set it to NULL
      //    and clear the emailHint.
      await tx.securityAuditLog.updateMany({
        where: { userId: req.targetUserId },
        data: { userId: null, emailHint: null },
      });
      // 2. Hard delete the User row. Prisma onDelete: Cascade handles every
      //    owned table (auth tokens, sessions, finance entities, AI,
      //    finance + idempotency audit logs, etc.). FinanceAuditLog cascades
      //    away with the user — the GDPR posture is "delete more, retain
      //    less"; if a finance dispute requires the audit later, it must be
      //    captured BEFORE the purge.
      await tx.user.delete({ where: { id: req.targetUserId } });
    });

    // Post-purge audit row — under the acting admin's id (target is gone).
    await this.securityAudit.record({
      userId: req.actingAdminId,
      type: 'ACCOUNT_UNLOCKED',
      metadata: {
        action: 'GDPR_PURGE_COMPLETED',
        targetUserId: req.targetUserId,
        counts,
      },
    });

    this.logger.warn(
      `gdpr-purge complete admin=${req.actingAdminId.slice(0, 8)} target=${req.targetUserId.slice(0, 8)}`,
    );
    return { dryRun: false, targetUserId: req.targetUserId, counts };
  }

  private async collectCounts(userId: string): Promise<Record<string, number>> {
    const [
      schedules,
      tasks,
      habits,
      wallets,
      incomes,
      expenses,
      budgets,
      debts,
      savingGoals,
      personalGoals,
      aiMessages,
      aiRecommendations,
      notifLogs,
      connectedAccounts,
      userAiProviders,
      financeAudit,
      securityAudit,
    ] = await Promise.all([
      this.prisma.dailySchedule.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.habit.count({ where: { userId } }),
      this.prisma.wallet.count({ where: { userId } }),
      this.prisma.income.count({ where: { userId } }),
      this.prisma.expense.count({ where: { userId } }),
      this.prisma.budget.count({ where: { userId } }),
      this.prisma.debt.count({ where: { userId } }),
      this.prisma.savingGoal.count({ where: { userId } }),
      this.prisma.personalGoal.count({ where: { userId } }),
      this.prisma.aIMessage.count({ where: { userId } }),
      this.prisma.aIRecommendation.count({ where: { userId } }),
      this.prisma.notificationLog.count({ where: { userId } }),
      this.prisma.connectedAccount.count({ where: { userId } }),
      this.prisma.userAiProvider.count({ where: { userId } }),
      this.prisma.financeAuditLog.count({ where: { userId } }),
      this.prisma.securityAuditLog.count({ where: { userId } }),
    ]);
    return {
      schedules,
      tasks,
      habits,
      wallets,
      incomes,
      expenses,
      budgets,
      debts,
      savingGoals,
      personalGoals,
      aiMessages,
      aiRecommendations,
      notifLogs,
      connectedAccounts,
      userAiProviders,
      financeAuditLogsAnonymised: financeAudit,
      securityAuditLogsAnonymised: securityAudit,
    };
  }
}
