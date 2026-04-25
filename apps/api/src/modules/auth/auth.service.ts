import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { LoginInput, RegisterInput, AuthTokens } from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityAuditService } from '../auth-security/security-audit.service';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
const LOCKOUT_DURATION_MS = 15 * 60_000;

// Pre-computed bcrypt hash of an unrelated string. We run a bcrypt against
// this when the email is unknown so the wall-clock time of "wrong email"
// matches "wrong password" — defends against email-enumeration via timing.
// Cost matches our real cost-10 hashes. Generated once with bcrypt.hashSync.
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuKqGyqL2yIVTKZqKkj.Ay9yTQJ6uyOOK';

type JwtPayload = { sub: string; email: string };

export type IssueContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: SecurityAuditService,
  ) {}

  async register(input: RegisterInput, ctx: IssueContext = {}): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException({
        message: 'Email already registered',
        errorCode: 'AUTH_EMAIL_TAKEN',
      });
    }

    const displayName = input.name ?? input.email.split('@')[0];
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName,
        profile: {
          create: {
            fullName: displayName,
            timezone: input.timezone,
          },
        },
        notificationSetting: {
          create: {},
        },
      },
    });
    return this.issueTokens(user.id, user.email, ctx);
  }

  async login(input: LoginInput, ctx: IssueContext = {}): Promise<AuthTokens> {
    const lower = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: lower } });

    // Privacy: do not reveal that the email is unknown — same wall-clock
    // path (run a bcrypt against a fixed dummy hash) and the same error
    // envelope as a wrong-password attempt.
    if (!user) {
      await bcrypt.compare(input.password, DUMMY_HASH).catch(() => undefined);
      await this.audit.record({
        emailHint: lower,
        type: SecurityEventType.LOGIN_FAILED,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: 'unknown_email' },
      });
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
      });
    }
    if (user.status === 'DISABLED') {
      await this.audit.record({
        userId: user.id,
        emailHint: lower,
        type: SecurityEventType.LOGIN_FAILED,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: 'account_disabled' },
      });
      throw new UnauthorizedException({
        message: 'Account disabled',
        errorCode: 'AUTH_ACCOUNT_DISABLED',
      });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSec = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
      throw new UnauthorizedException({
        message: 'Account is temporarily locked due to too many failed attempts',
        errorCode: 'ACCOUNT_TEMPORARILY_LOCKED',
        retryAfterSec,
      });
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      await this.recordFailedAttempt(user.id, lower, ctx);
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    // Success — reset counter; note "after failure" for audit signal.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.audit.record({
        userId: user.id,
        emailHint: lower,
        type: SecurityEventType.LOGIN_SUCCESS_AFTER_FAILURE,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { previousFailedCount: user.failedLoginCount },
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
    return this.issueTokens(user.id, user.email, ctx);
  }

  /**
   * Bumps failedLoginCount; if the user crosses the threshold inside the
   * window, sets `lockedUntil`. The window check uses
   * `lastFailedLoginAt`: if the prior failure was outside the window, the
   * counter resets to 1 (so a single failure 6 months later doesn't trigger
   * a lockout).
   */
  private async recordFailedAttempt(
    userId: string,
    emailHint: string,
    ctx: IssueContext,
  ): Promise<void> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginCount: true, lastFailedLoginAt: true },
    });
    if (!user) return;
    const inWindow =
      user.lastFailedLoginAt && now.getTime() - user.lastFailedLoginAt.getTime() <= LOCKOUT_WINDOW_MS;
    const nextCount = inWindow ? user.failedLoginCount + 1 : 1;
    const shouldLock = nextCount >= LOCKOUT_THRESHOLD;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextCount,
        lastFailedLoginAt: now,
        lockedUntil: shouldLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null,
      },
    });
    await this.audit.record({
      userId,
      emailHint,
      type: SecurityEventType.LOGIN_FAILED,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { failedCount: nextCount, locked: shouldLock },
    });
    if (shouldLock) {
      await this.audit.record({
        userId,
        emailHint,
        type: SecurityEventType.ACCOUNT_LOCKED,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { lockoutDurationMs: LOCKOUT_DURATION_MS },
      });
    }
  }

  async refresh(refreshToken: string, ctx: IssueContext = {}): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        errorCode: 'AUTH_INVALID_REFRESH_TOKEN',
      });
    }
    // OAuth 2 refresh-token rotation §6.1: a presented-but-revoked token
    // signals reuse-after-rotation (likely token theft). Revoke the entire
    // family so the attacker AND the legitimate user are both forced to
    // re-authenticate from scratch.
    if (stored.revokedAt) {
      await this.logoutAll(stored.userId).catch(() => undefined);
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        errorCode: 'AUTH_INVALID_REFRESH_TOKEN',
      });
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        errorCode: 'AUTH_INVALID_REFRESH_TOKEN',
      });
    }
    if (stored.user.status === 'DISABLED') {
      throw new UnauthorizedException({
        message: 'Account disabled',
        errorCode: 'AUTH_ACCOUNT_DISABLED',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user.id, stored.user.email, ctx);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    ctx: IssueContext,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    const expiresAt = new Date(Date.now() + this.parseExpiry(refreshExpiresIn));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')) / 1000,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(value: string): number {
    const match = /^(\d+)([smhdw])$/.exec(value);
    if (!match) return Number(value) * 1000;
    const n = Number(match[1]);
    const unit = match[2];
    const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit] ?? 1_000;
    return n * factor;
  }
}
