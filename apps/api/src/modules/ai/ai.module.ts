import { Module } from '@nestjs/common';

/**
 * The OpenAI proxy. Round 2 will add: capture parser, structured outputs.
 * AiModule decrypts the user's key per-request via UserAiKeyModule, never persists plaintext.
 */
@Module({})
export class AiModule {}
