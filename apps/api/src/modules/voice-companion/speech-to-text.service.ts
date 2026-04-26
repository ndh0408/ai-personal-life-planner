import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import type { TranscribeRequestInput, TranscribeResultDto } from '@planner/shared';

/**
 * Speech-to-text — Round 21 wires real OpenAI Whisper transcription.
 *
 * Flow:
 *   1. Locate the caller's active OPENAI provider row (BYOK).
 *   2. Decrypt the API key (held only for the duration of this call).
 *   3. POST `multipart/form-data` to OpenAI's
 *      `/v1/audio/transcriptions` endpoint with the audio bytes.
 *   4. Return the transcript verbatim.
 *
 * Privacy + safety invariants:
 *   - Audio is NEVER persisted server-side.
 *   - Audio is NEVER logged.
 *   - The decrypted API key is NEVER logged.
 *   - We only log `provider`, `model`, `bytes`, `ok`, `latencyMs`.
 *   - Endpoint is rate-limited at the controller level.
 *
 * If the user has no active OpenAI provider we return
 * `{ notImplemented: true, transcript: '' }` so the mobile UI can
 * surface "Add an OpenAI key" instead of an error toast.
 */
@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);
  private static readonly MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI cap

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async transcribe(
    userId: string,
    input: TranscribeRequestInput,
  ): Promise<TranscribeResultDto> {
    const audioBytes = Buffer.from(input.audioBase64, 'base64');
    if (audioBytes.byteLength === 0) {
      throw new BadRequestException({
        message: 'audio is empty',
        errorCode: 'BAD_REQUEST',
      });
    }
    if (audioBytes.byteLength > SpeechToTextService.MAX_AUDIO_BYTES) {
      throw new BadRequestException({
        message: 'audio too large',
        errorCode: 'BAD_REQUEST',
      });
    }

    // Use the user's BYOK OpenAI key. Whisper is an OpenAI-only API; we
    // intentionally do not fall back to a global key — voice transcription
    // sends raw audio off-device, so the user must explicitly opt in by
    // configuring their key.
    const provider = await this.prisma.userAiProvider.findFirst({
      where: { userId, provider: 'OPENAI', isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!provider) {
      this.logger.log(`transcribe userId=${userId} skipped — no openai provider`);
      return {
        transcript: '',
        locale: input.locale ?? 'vi',
        notImplemented: true,
      };
    }

    const apiKey = this.encryption.decrypt(provider.encryptedApiKey);
    const baseUrl = provider.baseUrl ?? 'https://api.openai.com/v1';
    const model = this.config.get<string>('OPENAI_WHISPER_MODEL') ?? 'whisper-1';

    const startedAt = Date.now();
    try {
      const transcript = await this.callWhisper({
        baseUrl,
        apiKey,
        model,
        audio: audioBytes,
        mimeType: input.mimeType,
        locale: input.locale,
      });
      this.logger.log(
        `transcribe ok userId=${userId} model=${model} bytes=${audioBytes.byteLength} latencyMs=${Date.now() - startedAt}`,
      );
      return {
        transcript: transcript.trim(),
        locale: input.locale ?? 'vi',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `transcribe failed userId=${userId} model=${model} bytes=${audioBytes.byteLength} latencyMs=${Date.now() - startedAt}: ${message.slice(0, 200)}`,
      );
      throw err;
    }
  }

  /**
   * POST multipart/form-data to OpenAI Whisper. Hand-rolled because
   * adding a `form-data` dep just for this would be overkill — we
   * build the boundary, headers, and body inline and pipe through
   * `fetch`. Compatible with the OpenAI-compatible endpoints from
   * NVIDIA, OpenRouter, and self-hosted Whisper.
   */
  private async callWhisper(args: {
    baseUrl: string;
    apiKey: string;
    model: string;
    audio: Buffer;
    mimeType: string;
    locale?: 'vi' | 'en';
  }): Promise<string> {
    const url = `${args.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`;
    const boundary = `----lifeos-${Math.random().toString(36).slice(2)}`;
    const filename = guessFilename(args.mimeType);

    const parts: (string | Buffer)[] = [];
    const push = (s: string) => parts.push(s);
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="model"\r\n\r\n${args.model}\r\n`);
    if (args.locale) {
      push(`--${boundary}\r\n`);
      push(`Content-Disposition: form-data; name="language"\r\n\r\n${args.locale}\r\n`);
    }
    push(`--${boundary}\r\n`);
    push(
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${args.mimeType}\r\n\r\n`,
    );
    parts.push(args.audio);
    push(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'utf8') : p)),
    );

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${args.apiKey}`,
        },
        body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        // Surface OpenAI's error code in the message so the mobile
        // error mapper can translate `OPENAI_KEY_INVALID` etc.
        throw new Error(
          `Whisper HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
      }
      try {
        const parsed = JSON.parse(text) as { text?: string };
        return parsed.text ?? '';
      } catch {
        return text; // some compatible servers return plain text
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function guessFilename(mimeType: string): string {
  if (/m4a|mp4|aac/i.test(mimeType)) return 'audio.m4a';
  if (/wav/i.test(mimeType)) return 'audio.wav';
  if (/webm/i.test(mimeType)) return 'audio.webm';
  if (/mpeg|mp3/i.test(mimeType)) return 'audio.mp3';
  return 'audio.bin';
}
