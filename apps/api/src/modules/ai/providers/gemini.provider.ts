import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
  AiProviderError,
} from './ai-provider.interface';

/**
 * Google Gemini (generativelanguage.googleapis.com) — `generateContent`
 * REST endpoint. Distinct shape from OpenAI: system prompt goes into
 * `systemInstruction`, user content into `contents[].parts[].text`, and the
 * API key is a `?key=` query parameter (not a Bearer header).
 *
 * NOTE: This adapter is intentionally minimal — it covers chat-completion-
 * style usage with optional JSON mode. Streaming, tool use, and the
 * Vertex AI variant are TODO; document a clear extension path in
 * `docs/USER_AI_PROVIDERS.md` if/when those are needed.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body: Record<string, unknown> = {
      systemInstruction: { role: 'system', parts: [{ text: req.system }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: req.jsonMode
                ? `${req.prompt}\n\nRespond with raw JSON only — no markdown fences, no commentary.`
                : req.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.4,
        ...(req.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new AiProviderError(
        `Gemini ${res.status}: ${errBody.slice(0, 500)}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('') ?? '';

    return {
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
      provider: this.name,
      model: this.model,
    };
  }
}
