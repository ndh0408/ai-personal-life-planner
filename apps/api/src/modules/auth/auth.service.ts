import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type {
  AuthResponse,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  UserPublic,
} from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessPayload {
  sub: string;
  email: string;
  type: 'access';
}
interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

const BCRYPT_COST = 12;

/** Parse a JWT TTL string ("15m", "30d", "3600s", "7d") into seconds. */
function ttlToSeconds(spec: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(spec.trim());
  if (!m) {
    const n = Number(spec);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    throw new Error(`Bad TTL spec: ${spec}`);
  }
  const n = Number(m[1]);
  const unit = m[2];
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd'];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtlSec = ttlToSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m');
    this.refreshTtlSec = ttlToSeconds(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d');
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async register(input: RegisterRequest, ctx: ClientContext): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          displayName: input.displayName ?? null,
          status: UserStatus.ACTIVE,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          error: { code: 'EMAIL_TAKEN', message: 'Email đã được dùng cho tài khoản khác.' },
        });
      }
      throw e;
    }

    // Auto-create the per-user singletons so future writes can upsert safely.
    await this.prisma.$transaction([
      this.prisma.userProfile.create({ data: { userId: user.id } }),
      this.prisma.privacySetting.create({ data: { userId: user.id } }),
      this.prisma.notificationSetting.create({ data: { userId: user.id } }),
    ]);

    const tokens = await this.issueTokens(user, ctx);
    return { user: toPublic(user), tokens };
  }

  async login(input: LoginRequest, ctx: ClientContext): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
      });
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' },
      });
    }
    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException({
        error: { code: 'ACCOUNT_DISABLED', message: 'Tài khoản này đã bị khoá.' },
      });
    }
    const tokens = await this.issueTokens(user, ctx);
    return { user: toPublic(user), tokens };
  }

  async refresh(rawRefresh: string, ctx: ClientContext): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawRefresh, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new Error('wrong token type');
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Phiên đăng nhập không hợp lệ.' },
      });
    }

    const tokenHash = sha256(rawRefresh);
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: payload.jti, userId: payload.sub, tokenHash },
    });
    if (!session) {
      // Token couldn't be matched. Could be a forged token or one that was
      // rotated long ago; either way: revoke every session for this user
      // (assumed theft) and bail.
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        error: { code: 'REFRESH_TOKEN_REVOKED', message: 'Phiên đăng nhập đã được thu hồi.' },
      });
    }
    if (session.revokedAt) {
      // Same defensive sweep — replay of a revoked token implies compromise.
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        error: { code: 'REFRESH_TOKEN_REVOKED', message: 'Phiên đăng nhập đã được thu hồi.' },
      });
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn.' },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        error: { code: 'ACCOUNT_DISABLED', message: 'Tài khoản này đã bị khoá.' },
      });
    }

    // Rotate: revoke the row, mint a new one inside one transaction.
    const newTokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return this.mintAndStoreTokens(user, ctx, tx);
    });
    return newTokens;
  }

  /** Logout: revoke the supplied refresh token (or all of the user's sessions if none given). */
  async logout(userId: string, rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) {
      const tokenHash = sha256(rawRefresh);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập không hợp lệ.' },
      });
    }
    return toPublic(user);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async issueTokens(user: User, ctx: ClientContext): Promise<AuthTokens> {
    return this.mintAndStoreTokens(user, ctx, this.prisma);
  }

  private async mintAndStoreTokens(
    user: User,
    ctx: ClientContext,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<AuthTokens> {
    // Pre-generate the refresh row id so it can serve as the JWT's jti claim.
    const jti = randomBytes(16).toString('base64url');
    const accessExpiresAt = new Date(Date.now() + this.accessTtlSec * 1000);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSec * 1000);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'access' } satisfies AccessPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTtlSec,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti, type: 'refresh' } satisfies RefreshPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTtlSec,
      },
    );

    await db.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: sha256(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessExpiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }
}

function toPublic(u: User): UserPublic {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
