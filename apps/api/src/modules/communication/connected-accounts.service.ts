import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedAccountProvider, type ConnectedAccount, type Prisma } from '@prisma/client';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

/**
 * Manages OAuth-connected mailboxes (Gmail / Outlook / IMAP).
 *
 * v1.2 ships the **shape** of OAuth — the actual upstream token-exchange
 * lives in v1.3 (needs OAuth client IDs registered in
 * Google Cloud / Microsoft Entra). For now the start endpoint returns the
 * provider's authorize URL and the callback throws
 * SERVICE_UNAVAILABLE / OAUTH_NOT_CONFIGURED so we never silently sync
 * blind. The token storage + DTO surface are real, so v1.3 is a drop-in
 * upgrade behind these methods.
 *
 * Tokens are AES-256-GCM-encrypted via EncryptionService; the API NEVER
 * returns the encrypted blob to the client (see DTO mapper).
 */
@Injectable()
export class ConnectedAccountsService {
  private readonly logger = new Logger(ConnectedAccountsService.name);
  /** In-memory state-token store. Production should use Redis with TTL. */
  private readonly oauthStates = new Map<
    string,
    { userId: string; provider: ConnectedAccountProvider; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  list(userId: string): Promise<ConnectedAccount[]> {
    return this.prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async startOAuth(
    userId: string,
    provider: ConnectedAccountProvider,
  ): Promise<{ authorizeUrl: string; state: string }> {
    // CSRF-resistant state — random + HMAC-bound to the user. The callback
    // re-derives the HMAC and rejects mismatches.
    const nonce = randomBytes(16).toString('hex');
    const secret = this.config.get<string>('AI_PROVIDER_ENCRYPTION_KEY') ?? 'dev-fallback';
    const sig = createHmac('sha256', secret).update(`${userId}:${provider}:${nonce}`).digest('hex').slice(0, 32);
    const state = `${nonce}.${sig}`;
    this.oauthStates.set(state, {
      userId,
      provider,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const clientId =
      provider === ConnectedAccountProvider.GMAIL
        ? this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')
        : provider === ConnectedAccountProvider.OUTLOOK
          ? this.config.get<string>('MICROSOFT_OAUTH_CLIENT_ID')
          : null;

    if (!clientId) {
      throw new ServiceUnavailableException({
        message: `OAuth client not configured for ${provider}`,
        errorCode: 'OAUTH_NOT_CONFIGURED',
      });
    }

    // Authorize URLs surfaced as STRINGS so the mobile can in-app-browser them.
    const redirectUri = this.config.get<string>('OAUTH_CALLBACK_BASE_URL') ?? '';
    const scope = provider === ConnectedAccountProvider.GMAIL
      ? 'https://www.googleapis.com/auth/gmail.readonly email profile'
      : 'offline_access Mail.Read User.Read';
    const base = provider === ConnectedAccountProvider.GMAIL
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const authorizeUrl =
      `${base}?response_type=code&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(`${redirectUri}/api/connected-accounts/${provider.toLowerCase()}/callback`)}` +
      `&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}` +
      `&access_type=offline&prompt=consent`;

    return { authorizeUrl, state };
  }

  /**
   * Validates the state nonce + HMAC; performs the upstream token exchange in
   * v1.3. Today we throw OAUTH_NOT_CONFIGURED so we never persist a
   * partially-validated account. Method signature kept stable so v1.3 can
   * fill in the token-exchange without touching callers.
   */
  async completeOAuth(
    _provider: ConnectedAccountProvider,
    state: string,
    _code: string,
  ): Promise<ConnectedAccount> {
    const entry = this.oauthStates.get(state);
    if (!entry) {
      throw new ForbiddenException({
        message: 'Invalid or expired OAuth state',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    if (entry.expiresAt < Date.now()) {
      this.oauthStates.delete(state);
      throw new ForbiddenException({
        message: 'OAuth state expired',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    // Provider mismatch: a /gmail/callback URL must not consume an Outlook
    // state (and vice versa). The provider is asserted by URL routing today,
    // but make the binding explicit so v1.3 can't accidentally relax it.
    if (entry.provider !== _provider) {
      this.oauthStates.delete(state);
      throw new ForbiddenException({
        message: 'OAuth state provider mismatch',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    // Defence-in-depth: re-derive the HMAC over `userId:provider:nonce` and
    // constant-time-compare with the sig fragment shipped in the state.
    // Today the state is also a Map key (so an attacker who lacks the secret
    // can't forge entries), but this guard means any future swap to Redis or
    // signed-JWT (no server map) inherits the same forgery resistance.
    const dot = state.indexOf('.');
    const nonce = dot > 0 ? state.slice(0, dot) : '';
    const sig = dot > 0 ? state.slice(dot + 1) : '';
    const secret = this.config.get<string>('AI_PROVIDER_ENCRYPTION_KEY') ?? 'dev-fallback';
    const expectedSig = createHmac('sha256', secret)
      .update(`${entry.userId}:${entry.provider}:${nonce}`)
      .digest('hex')
      .slice(0, 32);
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      this.oauthStates.delete(state);
      throw new ForbiddenException({
        message: 'OAuth state signature invalid',
        errorCode: 'OAUTH_STATE_INVALID',
      });
    }
    // One-shot: consume the state on success regardless of subsequent steps.
    this.oauthStates.delete(state);

    throw new ServiceUnavailableException({
      message: 'OAuth token exchange not yet wired in this build',
      errorCode: 'OAUTH_NOT_CONFIGURED',
    });
  }

  /**
   * Server-internal helper used by v1.3 OAuth callback OR by tests. Encrypts
   * the upstream tokens and persists them. Never invoked over HTTP.
   */
  async upsertAfterTokenExchange(args: {
    userId: string;
    provider: ConnectedAccountProvider;
    email: string;
    displayName?: string | null;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
    scopes: string[];
  }): Promise<ConnectedAccount> {
    const data: Prisma.ConnectedAccountCreateInput = {
      user: { connect: { id: args.userId } },
      provider: args.provider,
      email: args.email,
      displayName: args.displayName ?? null,
      encryptedAccessToken: this.encryption.encrypt(args.accessToken),
      encryptedRefreshToken: args.refreshToken
        ? this.encryption.encrypt(args.refreshToken)
        : null,
      tokenExpiresAt: args.tokenExpiresAt ?? null,
      scopes: args.scopes as Prisma.InputJsonValue,
    };
    return this.prisma.connectedAccount.upsert({
      where: {
        userId_provider_email: {
          userId: args.userId,
          provider: args.provider,
          email: args.email,
        },
      },
      create: data,
      update: {
        encryptedAccessToken: data.encryptedAccessToken,
        encryptedRefreshToken: data.encryptedRefreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        displayName: data.displayName,
        isActive: true,
      },
    });
  }

  async disconnect(userId: string, id: string, deleteCachedData = true): Promise<void> {
    const row = await this.prisma.connectedAccount.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Account not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    }
    await this.prisma.$transaction(async (tx) => {
      if (deleteCachedData) {
        await tx.emailItem.deleteMany({ where: { connectedAccountId: id } });
      } else {
        await tx.emailItem.updateMany({
          where: { connectedAccountId: id },
          data: { connectedAccountId: id },
        });
      }
      await tx.connectedAccount.delete({ where: { id } });
    });
  }
}
