import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
  AiProviderError,
} from './ai-provider.interface';

export interface OpenAiCompatibleOptions {
  /**
   * Display name reported in `AiCompletionResponse.provider` and logs.
   * Defaults to "openai"; pass "nvidia"/"openrouter"/"custom" so audit logs
   * differentiate.
   */
  name?: string;
  /**
   * Full chat-completions endpoint URL. Defaults to OpenAI's. For
   * OpenAI-compatible providers (NVIDIA, OpenRouter, custom) pass the
   * provider's `<base>/chat/completions`.
   */
  endpoint?: string;
  /** Extra headers to merge with the default request — e.g. OpenRouter's
   * HTTP-Referer / X-Title. Never logged. */
  extraHeaders?: Record<string, string>;
}

/**
 * Generic OpenAI Chat Completions client. Used directly for OpenAI itself
 * AND as the transport for any OpenAI-compatible provider (NVIDIA NIM,
 * OpenRouter, user-supplied custom endpoints).
 */
export class OpenAiProvider implements AiProvider {
  readonly name: string;
  private readonly endpoint: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    optsOrEndpoint: string | OpenAiCompatibleOptions = {},
  ) {
    if (typeof optsOrEndpoint === 'string') {
      this.endpoint = optsOrEndpoint;
      this.extraHeaders = {};
      this.name = 'openai';
    } else {
      this.endpoint = optsOrEndpoint.endpoint ?? 'https://api.openai.com/v1/chat/completions';
      this.extraHeaders = optsOrEndpoint.extraHeaders ?? {};
      this.name = optsOrEndpoint.name ?? 'openai';
    }
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_completion_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
    };
    if (req.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new AiProviderError(
        `${this.name} ${res.status}: ${errBody.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      },
      provider: this.name,
      model: this.model,
    };
  }
}
