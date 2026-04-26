import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiKeyTestStatus, AiProvider } from '@prisma/client';
import OpenAI from 'openai';
import type { AiKeyStatus, TestAiKeyResponse } from '@lifeos/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';

const TEST_TIMEOUT_MS = 8_000;

@Injectable()
export class UserAiKeyService {
  // The logger is wired so we never accidentally pass `apiKey` into it.
  private readonly logger = new Logger(UserAiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  // ── Setup ────────────────────────────────────────────────────────────────

  async setupOpenAi(userId: string, apiKey: string): Promise<AiKeyStatus> {
    const fingerprint = EncryptionService.fingerprint(apiKey);
    const baseUrl = this.config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
    const defaultModel = this.config.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-4o-mini';

    const test = await this.runLiveTest(apiKey, baseUrl);
    const encrypted = this.enc.seal(apiKey);

    await this.prisma.userAiKey.upsert({
      where: { userId },
      create: {
        userId,
        provider: AiProvider.OPENAI,
        encryptedApiKey: encrypted,
        apiKeyLast4: fingerprint.last4,
        maskedApiKey: fingerprint.masked,
        baseUrl,
        defaultModel,
        lastTestedAt: new Date(),
        lastTestStatus: test.ok ? AiKeyTestStatus.SUCCESS : AiKeyTestStatus.FAILED,
        isActive: true,
      },
      update: {
        encryptedApiKey: encrypted,
        apiKeyLast4: fingerprint.last4,
        maskedApiKey: fingerprint.masked,
        baseUrl,
        defaultModel,
        lastTestedAt: new Date(),
        lastTestStatus: test.ok ? AiKeyTestStatus.SUCCESS : AiKeyTestStatus.FAILED,
        isActive: true,
      },
    });

    this.logger.log(
      `userAiKey saved (userId=${userId}, last4=${fingerprint.last4}, test=${test.ok ? 'OK' : 'FAIL'})`,
    );
    return this.statusFor(userId);
  }

  // ── Test against the live provider ───────────────────────────────────────

  async testStored(userId: string): Promise<TestAiKeyResponse> {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: 'AI_KEY_NOT_FOUND', message: 'Bạn chưa cài đặt API key.' },
      });
    }
    let plain: string;
    try {
      plain = this.enc.open(row.encryptedApiKey);
    } catch {
      this.logger.error(`failed to decrypt stored key for userId=${userId}`);
      return { status: 'FAILED', maskedApiKey: row.maskedApiKey, message: 'Không thể giải mã key.' };
    }
    const test = await this.runLiveTest(plain, row.baseUrl);
    await this.prisma.userAiKey.update({
      where: { userId },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: test.ok ? AiKeyTestStatus.SUCCESS : AiKeyTestStatus.FAILED,
      },
    });
    return {
      status: test.ok ? 'SUCCESS' : 'FAILED',
      maskedApiKey: row.maskedApiKey,
      message: test.message,
    };
  }

  // ── Status ───────────────────────────────────────────────────────────────

  async statusFor(userId: string): Promise<AiKeyStatus> {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row || !row.isActive) {
      return {
        enabled: false,
        provider: null,
        maskedApiKey: null,
        lastTestStatus: null,
        lastTestedAt: null,
      };
    }
    return {
      enabled: true,
      provider: row.provider,
      maskedApiKey: row.maskedApiKey,
      lastTestStatus: row.lastTestStatus,
      lastTestedAt: row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
    };
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async deleteFor(userId: string): Promise<void> {
    await this.prisma.userAiKey.deleteMany({ where: { userId } });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Calls `models.list` against the provider with a hard timeout. Never logs
   * the key. Maps any failure to a flat { ok, message } result so callers can
   * decide whether to persist (setup) or just report (test).
   */
  private async runLiveTest(
    apiKey: string,
    baseUrl: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
    try {
      const client = new OpenAI({ apiKey, baseURL: baseUrl });
      // Lightest possible probe — list models is read-only and free.
      await client.models.list({ signal: ctrl.signal });
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string; message?: string; name?: string };
      if (err?.name === 'AbortError') {
        return { ok: false, message: 'Hết thời gian kết nối tới OpenAI.' };
      }
      if (err?.status === 401) {
        return { ok: false, message: 'API key không hợp lệ.' };
      }
      if (err?.status === 429) {
        return { ok: false, message: 'API key đã hết quota.' };
      }
      if (err?.status && err.status >= 500) {
        return { ok: false, message: 'OpenAI đang gặp sự cố. Thử lại sau.' };
      }
      // Don't echo provider error messages verbatim — they sometimes contain key fragments.
      return { ok: false, message: 'Không thể kết nối tới OpenAI.' };
    } finally {
      clearTimeout(timer);
    }
  }
}
