import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { LoginInput, RegisterInput, AuthTokens } from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';

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
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
      });
    }
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException({
        message: 'Account disabled',
        errorCode: 'AUTH_ACCOUNT_DISABLED',
      });
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    return this.issueTokens(user.id, user.email, ctx);
  }

  async refresh(refreshToken: string, ctx: IssueContext = {}): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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
