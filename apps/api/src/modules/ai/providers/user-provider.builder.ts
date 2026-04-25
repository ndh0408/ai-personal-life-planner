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
 * SSRF guard for user-supplied AI baseUrl.
 *
 * The CUSTOM_OPENAI_COMPATIBLE provider lets a user point the resolver at any
 * `http(s)://...` endpoint — that is exactly the surface an attacker would
 * use to make our backend fetch internal services or cloud-metadata IPs from
 * inside the VPC.
 *
 * Validation runs at TWO points:
 *   1. CRUD time (when the user submits the URL) — fast UX feedback.
 *   2. Just before the actual fetch in {@link buildUserProvider} — closes
 *      DNS-rebinding (the URL resolves to a public IP at validation time and
 *      a private IP at fetch time).
 *
 * The blocklist covers loopback, link-local (incl. cloud metadata
 * 169.254.169.254), RFC1918 private space, IPv6 equivalents, and the
 * unspecified address. Hostnames `localhost`, `metadata`, `metadata.google.
 * internal` are also rejected by name (some platforms resolve them without
 * touching DNS).
 *
 * Throws {@link InvalidUserProviderConfigError} on any violation.
 */
export function validateUserBaseUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidUserProviderConfigError('baseUrl must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUserProviderConfigError(
      `baseUrl scheme "${url.protocol}" is not allowed (use http or https)`,
    );
  }
  // hostname comes without surrounding [] for IPv6
  const host = url.hostname.toLowerCase();

  // Hostname-based blocklist — catches values that may not resolve via the
  // platform's DNS at all.
  const HOST_BLOCKLIST = new Set([
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    'metadata',
    'metadata.google.internal',
  ]);
  if (HOST_BLOCKLIST.has(host)) {
    throw new InvalidUserProviderConfigError(
      `baseUrl host "${host}" is not allowed`,
    );
  }

  // IP literal checks (covers DNS-resolution-at-fetch-time path too when the
  // attacker supplies an IP directly).
  if (isPrivateOrLoopbackHost(host)) {
    throw new InvalidUserProviderConfigError(
      `baseUrl host "${host}" resolves to a non-public address`,
    );
  }

  return url;
}

function isPrivateOrLoopbackHost(host: string): boolean {
  // IPv4 literal?
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [, a, b] = ipv4.map((s) => Number(s)) as number[];
    if (a === 0) return true;                     // 0.0.0.0/8
    if (a === 10) return true;                    // RFC1918
    if (a === 127) return true;                   // loopback
    if (a === 169 && b === 254) return true;      // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true;      // RFC1918
    if (a >= 224) return true;                    // multicast / reserved
    return false;
  }
  // IPv6 literal?
  const v6 = host.replace(/^\[|\]$/g, '');
  if (v6.includes(':')) {
    const norm = v6.toLowerCase();
    if (norm === '::' || norm === '::1') return true;
    if (norm.startsWith('fe80:') || norm.startsWith('fe8') || norm.startsWith('fc') || norm.startsWith('fd')) {
      return true; // link-local + ULA
    }
    if (norm.startsWith('::ffff:')) {
      // IPv4-mapped — recurse on the embedded IPv4
      const embedded = norm.slice(7);
      return isPrivateOrLoopbackHost(embedded);
    }
    return false;
  }
  return false;
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
      // SSRF guard: validate at fetch time too, not just CRUD time, so a
      // DNS-rebinding attack (public at create, private at use) is caught.
      validateUserBaseUrl(baseUrl);
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
