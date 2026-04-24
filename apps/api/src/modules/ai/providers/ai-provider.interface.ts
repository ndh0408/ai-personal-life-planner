/** Provider-agnostic completion call. */
export interface AiCompletionRequest {
  /** System instruction (server-trusted, not user-controlled). */
  system: string;
  /** User-facing prompt. May contain user data wrapped in delimited blocks. */
  prompt: string;
  /** When true, the provider should respond with raw JSON only. */
  jsonMode?: boolean;
  /** Max output tokens. */
  maxTokens?: number;
  /** Temperature 0-2. */
  temperature?: number;
}

export interface AiCompletionResponse {
  /** Raw text the model produced. */
  text: string;
  /** Optional usage info; providers may omit. */
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Provider name for audit. */
  provider: string;
  /** Model identifier. */
  model: string;
}

export interface AiProvider {
  readonly name: string;
  complete(req: AiCompletionRequest): Promise<AiCompletionResponse>;
}

/** Thrown when the provider exceeds the timeout. */
export class AiTimeoutError extends Error {
  constructor(public readonly elapsedMs: number) {
    super(`AI request timed out after ${elapsedMs}ms`);
    this.name = 'AiTimeoutError';
  }
}

/** Thrown when the provider returns a non-2xx / unparseable response. */
export class AiProviderError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'AiProviderError';
  }
}
