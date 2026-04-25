import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generateAuthToken, hashAuthToken } from './auth-token.util';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider';
import { SecurityAuditService } from './security-audit.service';

const TOKEN_TTL_HOURS = 24;
const MIN_RESEND_INTERVAL_MS = 60_000; // 1 token per minute per user

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: SecurityAuditService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /**
   * Issues a fresh verification token for the user (creating one if no
   * unverified user matches the email). Always returns success to avoid
   * leaking which email addresses exist.
   */
  async resend(
    email: string,
    ctx: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<void> {
    const lower = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: lower } });
    if (!user || user.emailVerifiedAt) {
      // Privacy: same path / same latency as the success branch.
      return;
    }
    // Per-user resend throttle — also guards against an attacker with a
    // valid email farming verification rows.
    const recent = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < MIN_RESEND_INTERVAL_MS) {
      return;
    }
    const { raw, hash } = generateAuthToken(32);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000),
      },
    });
    await this.audit.record({
      userId: user.id,
      emailHint: lower,
      type: SecurityEventType.EMAIL_VERIFICATION_REQUESTED,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const baseUrl = this.config.get<string>('APP_PUBLIC_URL') ?? 'https://lifeos.example';
    const link = `${baseUrl}/verify-email?token=${encodeURIComponent(raw)}`;
    // The raw URL lives only in the outbound email body; we never log it.
    await this.emailProvider.send({
      to: user.email,
      subject: 'Verify your LifeOS email',
      text:
        `Hi ${user.displayName},\n\n` +
        `Please verify your email by visiting:\n${link}\n\n` +
        `This link expires in ${TOKEN_TTL_HOURS} hours.\n` +
        `If you didn't create an account, you can ignore this email.`,
    });
  }

  /**
   * Consume a token. Marks the token used + sets `emailVerifiedAt`.
   * Idempotent for already-verified users (returns success without error).
   */
  async verify(
    rawToken: string,
    ctx: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<{ alreadyVerified: boolean }> {
    if (!rawToken || rawToken.length < 16) {
      throw new BadRequestException({ message: 'Invalid token', errorCode: 'AUTH_TOKEN_INVALID' });
    }
    const tokenHash = hashAuthToken(rawToken);
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
    });
    if (!token) {
      throw new NotFoundException({
        message: 'Invalid or expired verification token',
        errorCode: 'AUTH_TOKEN_INVALID',
      });
    }
    if (token.user.emailVerifiedAt) {
      return { alreadyVerified: true };
    }
    if (token.usedAt) {
      throw new BadRequestException({
        message: 'Verification token already used',
        errorCode: 'AUTH_TOKEN_USED',
      });
    }
    if (token.expiresAt < new Date()) {
      throw new BadRequestException({
        message: 'Verification token expired',
        errorCode: 'AUTH_TOKEN_EXPIRED',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      // Optional: consume any other unused tokens for this user too.
      await tx.emailVerificationToken.updateMany({
        where: { userId: token.userId, usedAt: null, NOT: { id: token.id } },
        data: { usedAt: new Date() },
      });
    });
    await this.audit.record({
      userId: token.userId,
      emailHint: token.user.email,
      type: SecurityEventType.EMAIL_VERIFICATION_COMPLETED,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { alreadyVerified: false };
  }
}
