import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AiProvider } from './ai-provider.interface';
import { MockAiProvider } from './mock.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAiProvider } from './openai.provider';

export const AI_PROVIDER_TOKEN = Symbol('AI_PROVIDER');

export function buildAiProvider(config: ConfigService): AiProvider {
  const logger = new Logger('AiProviderFactory');
  const requested = (config.get<string>('AI_PROVIDER') ?? 'mock').toLowerCase();
  const apiKey = config.get<string>('AI_API_KEY');
  const model = config.get<string>('AI_MODEL') ?? 'claude-sonnet-4-6';

  if (requested === 'mock' || !apiKey) {
    if (requested !== 'mock') {
      logger.warn(`AI_PROVIDER=${requested} but AI_API_KEY missing — falling back to mock`);
    }
    return new MockAiProvider();
  }

  if (requested === 'anthropic') {
    return new AnthropicProvider(apiKey, model);
  }
  if (requested === 'openai') {
    return new OpenAiProvider(apiKey, model);
  }
  logger.warn(`Unknown AI_PROVIDER="${requested}" — using mock`);
  return new MockAiProvider();
}
