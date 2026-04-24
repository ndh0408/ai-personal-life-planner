import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
  AiProviderError,
} from './ai-provider.interface';

/**
 * Thin Anthropic Messages API client. Kept dependency-free (uses fetch) so the
 * SDK isn't pulled in until really needed. Swap for the official SDK later if
 * we want streaming or tool use.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly endpoint: string = 'https://api.anthropic.com/v1/messages',
  ) {}

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const body = {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      system: req.system,
      messages: [
        {
          role: 'user',
          content: req.jsonMode
            ? `${req.prompt}\n\nRespond with raw JSON only — no markdown fences, no commentary.`
            : req.prompt,
        },
      ],
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new AiProviderError(`Anthropic ${res.status}: ${errBody.slice(0, 500)}`, res.status);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text =
      data.content?.filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text)
        .join('\n') ?? '';

    return {
      text,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      provider: this.name,
      model: this.model,
    };
  }
}
