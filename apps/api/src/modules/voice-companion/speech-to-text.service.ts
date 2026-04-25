import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TranscribeRequestInput, TranscribeResultDto } from '@planner/shared';

/**
 * Speech-to-text provider abstraction.
 *
 * v1.2 ships ONLY a "no-op" implementation that returns
 * `{ notImplemented: true, transcript: '' }`. The endpoint exists so the
 * mobile contract is stable; once an STT provider is wired (OpenAI Whisper,
 * Gemini, Google Speech, Apple Speech) the same service swaps in without
 * touching callers.
 *
 * Wiring options (post v1.2):
 *   - OpenAI Whisper: HTTP POST to /v1/audio/transcriptions with the
 *     base64-decoded audio. Privacy: Whisper is a third-party. Surface in
 *     PRIVACY_VOICE.md when wired.
 *   - Gemini speech: requires Google Cloud creds.
 *   - Apple Speech (on-device): client-side, NOT this endpoint.
 *
 * Hard rules (enforced today even by the no-op):
 *   - Audio is NEVER persisted server-side.
 *   - Audio is NEVER logged.
 *   - The endpoint is rate-limited at the controller level.
 *   - Auth required.
 */
@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(
    _userId: string,
    input: TranscribeRequestInput,
  ): Promise<TranscribeResultDto> {
    const provider = (this.config.get<string>('STT_PROVIDER') ?? 'none').toLowerCase();
    if (provider === 'none' || provider === 'mock') {
      // Log NOTHING about the audio. Just record metadata.
      this.logger.log(
        `transcribe stub provider=${provider} mime=${input.mimeType} bytes=${Buffer.byteLength(
          input.audioBase64,
          'base64',
        )}`,
      );
      return {
        transcript: '',
        locale: input.locale ?? 'vi',
        notImplemented: true,
      };
    }
    // Real STT lands in v1.3 — keep the throw explicit so callers know.
    throw new Error(`STT provider ${provider} is not yet implemented`);
  }
}
