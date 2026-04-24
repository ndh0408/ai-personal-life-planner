import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
  AiProviderError,
} from './ai-provider.interface';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly endpoint: string = 'https://api.openai.com/v1/chat/completions',
  ) {}

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
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new AiProviderError(`OpenAI ${res.status}: ${errBody.slice(0, 500)}`, res.status);
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
