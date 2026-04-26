import type { CaptureKind, ParserSource } from '@lifeos/shared';

export interface ParseContext {
  /** Reference time for relative-date heuristics. */
  now: Date;
  /** IANA tz, e.g. "Asia/Ho_Chi_Minh". */
  tz: string;
}

export interface ParseHit {
  kind: CaptureKind;
  source: ParserSource;
  /** 0 (rejected) … 1 (sure). The orchestrator picks the highest. */
  confidence: number;
  fields: Record<string, unknown>;
  previewText: string;
  hint?: string;
}

export interface RuleParser {
  /** Returns null if this parser can't make a usable guess. */
  match(text: string, ctx: ParseContext): ParseHit | null;
}
