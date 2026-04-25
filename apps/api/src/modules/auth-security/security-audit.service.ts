import { Injectable, Logger } from '@nestjs/common';
import { type Prisma, type SecurityEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type SecurityAuditInput = {
  userId?: string | null;
  /** Lower-cased email used during the request, captured even when no user matched. */
  emailHint?: string | null;
  type: SecurityEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  tx?: Prisma.TransactionClient;
};

/**
 * Append-only auth-event log. Used by:
 *  - AuthService.login (LOGIN_FAILED, ACCOUNT_LOCKED, LOGIN_SUCCESS_AFTER_FAILURE)
 *  - PasswordResetService (PASSWORD_RESET_REQUESTED / COMPLETED)
 *  - EmailVerificationService (EMAIL_VERIFICATION_REQUESTED / COMPLETED)
 *
 * Privacy: never store the password, the token, or the verification link. The
 * controller passes lower-cased email + UA + IP only.
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: SecurityAuditInput): Promise<void> {
    try {
      const client = input.tx ?? this.prisma;
      await client.securityAuditLog.create({
        data: {
          userId: input.userId ?? null,
          emailHint: input.emailHint?.toLowerCase().slice(0, 320) ?? null,
          type: input.type,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent?.slice(0, 256) ?? null,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (e) {
      // Never block an auth path on audit-log failure.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`security audit write failed: ${msg}`);
    }
  }
}
