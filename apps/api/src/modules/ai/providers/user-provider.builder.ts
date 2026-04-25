import { ConfigService } from '@nestjs/config';
import type { UserAiProviderType } from '@prisma/client';
import type { AiProvider } from './ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';

/**
 * Lightweight description of a user-stored provider config — only the fields
 * the builder needs. The caller (resolver service) is responsible for
 * decrypting the API key and passing it as `decryptedApiKey`.
 */
export interface UserProviderInput {
  provider: UserAiProviderType;
  baseUrl?: string | null;
  decryptedApiKey: string;
  model: string;
}

/** Throw when the user-supplied config is structurally invalid (e.g. CUSTOM
 *  endpoint without a baseUrl). Resolver maps these to INVALID_PROVIDER_CONFIG. */
export class InvalidUserProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserProviderConfigError';
  }
}

const NVIDIA_DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';
const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
const OPENROUTER_DEFAULT_BASE = 'https://openrouter.ai/api/v1';
const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com/v1';
const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function trimSlash(s: string): string {
  return s.replace(/\/$/, '');
}

/**
 * Build a one-shot AiProvider client from a user-stored config. The returned
 * client is ephemeral — created per request, holds the decrypted key in
 * closure, and is discarded after the call so we never cache plaintext keys.
 */
export function buildUserProvider(
  input: UserProviderInput,
  config: ConfigService,
): AiProvider {
  const baseUrl = input.baseUrl?.trim() || undefined;

  switch (input.provider) {
    case 'OPENAI': {
      const base = trimSlash(baseUrl ?? OPENAI_DEFAULT_BASE);
      return new OpenAiProvider(input.decryptedApiKey, input.model, {
        name: 'openai',
        endpoint: `${base}/chat/completions`,
      });
    }
    case 'NVIDIA': {
      const base = trimSlash(baseUrl ?? NVIDIA_DEFAULT_BASE);
      return new OpenAiProvider(input.decryptedApiKey, input.model, {
        name: 'nvidia',
        endpoint: `${base}/chat/completions`,
      });
    }
    case 'OPENROUTER': {
      const base = trimSlash(baseUrl ?? OPENROUTER_DEFAULT_BASE);
      const referer = config.get<string>('OPENROUTER_HTTP_REFERER');
      const title = config.get<string>('OPENROUTER_X_TITLE');
      const extraHeaders: Record<string, string> = {};
      if (referer) extraHeaders['HTTP-Referer'] = referer;
      if (title) extraHeaders['X-Title'] = title;
      return new OpenAiProvider(input.decryptedApiKey, input.model, {
        name: 'openrouter',
        endpoint: `${base}/chat/completions`,
        extraHeaders,
      });
    }
    case 'CUSTOM_OPENAI_COMPATIBLE': {
      if (!baseUrl) {
        throw new InvalidUserProviderConfigError(
          'baseUrl is required for CUSTOM_OPENAI_COMPATIBLE',
        );
      }
      if (!/^https?:\/\//i.test(baseUrl)) {
        throw new InvalidUserProviderConfigError('baseUrl must be a full http(s) URL');
      }
      const base = trimSlash(baseUrl);
      return new OpenAiProvider(input.decryptedApiKey, input.model, {
        name: 'custom',
        endpoint: `${base}/chat/completions`,
      });
    }
    case 'ANTHROPIC': {
      const base = trimSlash(baseUrl ?? ANTHROPIC_DEFAULT_BASE);
      return new AnthropicProvider(input.decryptedApiKey, input.model, `${base}/messages`);
    }
    case 'GEMINI': {
      const base = trimSlash(baseUrl ?? GEMINI_DEFAULT_BASE);
      return new GeminiProvider(input.decryptedApiKey, input.model, base);
    }
    default: {
      const _exhaustive: never = input.provider;
      throw new InvalidUserProviderConfigError(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

/** Default base URL surfaced to the mobile UI for the "baseUrl placeholder" hint. */
export function defaultBaseUrlFor(provider: UserAiProviderType): string | null {
  switch (provider) {
    case 'OPENAI':
      return OPENAI_DEFAULT_BASE;
    case 'NVIDIA':
      return NVIDIA_DEFAULT_BASE;
    case 'OPENROUTER':
      return OPENROUTER_DEFAULT_BASE;
    case 'ANTHROPIC':
      return ANTHROPIC_DEFAULT_BASE;
    case 'GEMINI':
      return GEMINI_DEFAULT_BASE;
    case 'CUSTOM_OPENAI_COMPATIBLE':
      return null;
  }
}
