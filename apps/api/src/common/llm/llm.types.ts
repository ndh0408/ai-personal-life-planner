/**
 * Public types for LlmService (round 29).
 *
 * Kept in a separate file so callers don't pull in the OpenAI SDK just to
 * type-check a request shape.
 */

/**
 * Which feature is calling — picks the default model from OPENAI_FAST_MODEL
 * or OPENAI_SMART_MODEL, and tags the usage log so we can audit per-feature
 * cost / latency later.
 */
export type LlmTier = 'fast' | 'smart';

export interface LlmStreamEvent {
  /** "delta" — a chunk of text. "done" — final assembled text. "error" — fatal. */
  type: 'delta' | 'done' | 'error';
  delta?: string;
  finalText?: string;
  code?: string;
  message?: string;
}

/**
 * A JSON Schema describing the structured output the model must return.
 * The Responses API enforces it server-side when `strict: true`, so a
 * hallucinated field shape can't reach our parsers.
 */
export interface LlmJsonSchema {
  /** A short label for the schema; surfaced in error messages. */
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface LlmCallContext {
  userId: string;
  /** Feature name for logging (e.g. "capture-parse", "assistant-chat"). */
  feature: string;
}

export interface LlmTextRequest extends LlmCallContext {
  tier: LlmTier;
  instructions?: string;
  input: string;
  /** Override the per-tier model default. */
  modelOverride?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Wall-clock cap before we abort. Default 30 s. */
  timeoutMs?: number;
}

export interface LlmJsonRequest<T> extends LlmCallContext {
  tier: LlmTier;
  instructions?: string;
  input: string;
  schema: LlmJsonSchema;
  modelOverride?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /**
   * Validates the parsed JSON before returning. The Responses API's strict
   * schema is the first defence; this is a belt-and-braces second layer
   * (e.g. for value-range checks the JSON Schema can't express).
   */
  validate?: (value: unknown) => T;
}

export interface LlmStreamRequest extends LlmCallContext {
  tier: LlmTier;
  instructions?: string;
  input: string;
  modelOverride?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Aborter the caller can flip to stop the stream early. */
  signal?: AbortSignal;
}

export class LlmError extends Error {
  constructor(
    public readonly code:
      | 'AI_KEY_MISSING'
      | 'AI_KEY_DECRYPT_FAILED'
      | 'AI_KEY_REJECTED'
      | 'AI_QUOTA_EXCEEDED'
      | 'AI_TIMEOUT'
      | 'AI_SCHEMA_VIOLATION'
      | 'AI_UNAVAILABLE',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
