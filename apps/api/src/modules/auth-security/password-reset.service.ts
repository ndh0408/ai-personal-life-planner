import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { generateAuthToken, hashAuthToken } from './auth-token.util';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider';
import { SecurityAuditService } from './security-audit.service';

const TOKEN_TTL_MINUTES = 30;
const MIN_RESEND_INTERVAL_MS = 60_000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: SecurityAuditService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /**
   * Always returns success even when the email doesn't match a user — this
   * is the standard "no email enumeration" pattern. We DO write the audit
   * row with the emailHint so a DBA / security investigation can still see
   * patterns of attempts.
   */
  async forgot(
    email: string,
    ctx: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    const lower = email.trim().toLowerCase();
    await this.audit.record({
      emailHint: lower,
      type: SecurityEventType.PASSWORD_RESET_REQUESTED,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const user = await this.prisma.user.findUnique({ where: { email: lower } });
    if (!user || user.status === 'DISABLED') return;
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < MIN_RESEND_INTERVAL_MS) {
      return;
    }
    const { raw, hash } = generateAuthToken(32);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
      },
    });
    const baseUrl = this.config.get<string>('APP_PUBLIC_URL') ?? 'https://lifeos.example';
    const link = `${baseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
    await this.emailProvider.send({
      to: user.email,
      subject: 'Reset your LifeOS password',
      text:
        `Hi ${user.displayName},\n\n` +
        `We received a request to reset your password. Visit:\n${link}\n\n` +
        `This link expires in ${TOKEN_TTL_MINUTES} minutes.\n` +
        `If you didn't request this, you can ignore this email.`,
    });
  }

  /**
   * Consume a reset token + set a new password. Inside one transaction we:
   *  - validate token (existence, usedAt, expiresAt)
   *  - validate new password against the policy
   *  - bcrypt the new password
   *  - update User.passwordHash
   *  - mark token used
   *  - revoke every refresh token (forces re-login on every device)
   *
   * Audit row written after successful commit.
   */
  async reset(
    rawToken: string,
    newPassword: string,
    ctx: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    if (!rawToken || rawToken.length < 16) {
      throw new BadRequestException({ message: 'Invalid token', errorCode: 'AUTH_TOKEN_INVALID' });
    }
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      throw new BadRequestException({
        message: 'Password must be 8–128 characters',
        errorCode: 'PASSWORD_POLICY_FAILED',
      });
    }
    if (!/[a-z]/i.test(newPassword) || !/\d/.test(newPassword)) {
      throw new BadRequestException({
        message: 'Password must contain a letter and a digit',
        errorCode: 'PASSWORD_POLICY_FAILED',
      });
    }
    const tokenHash = hashAuthToken(rawToken);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (!token) {
      throw new NotFoundException({
        message: 'Invalid or expired reset token',
        errorCode: 'AUTH_TOKEN_INVALID',
      });
    }
    if (token.usedAt) {
      throw new BadRequestException({
        message: 'Reset token already used',
        errorCode: 'AUTH_TOKEN_USED',
      });
    }
    if (token.expiresAt < new Date()) {
      throw new BadRequestException({
        message: 'Reset token expired',
        errorCode: 'AUTH_TOKEN_EXPIRED',
      });
    }
    if (token.user.status === 'DISABLED') {
      throw new BadRequestException({
        message: 'Account disabled',
        errorCode: 'AUTH_ACCOUNT_DISABLED',
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          // Clear lockout state — the user proved control of their email.
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      // Force every device to re-login.
      await tx.refreshToken.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    await this.audit.record({
      userId: token.userId,
      emailHint: token.user.email,
      type: SecurityEventType.PASSWORD_RESET_COMPLETED,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }
}
