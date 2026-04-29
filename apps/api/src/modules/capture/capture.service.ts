/**
 * Capture parser orchestrator (round 21).
 *
 * Routes a raw user sentence into a structured preview using a three-tier
 * confidence policy:
 *
 *   strong rule (≥ STRONG)     → return rule, source=RULE, no LLM call
 *   medium  (MEDIUM..STRONG)   → call LLM with recent-corrections few-shot;
 *                                pick whichever scores higher; mark source
 *                                HYBRID. Falls back to weak rule if LLM unavailable.
 *   weak    (< MEDIUM)         → UNKNOWN + needsReview. The UI surfaces the
 *                                kind picker.
 *
 * The previous single-threshold layout (≥ 0.7 → keep rule, < 0.7 → ask LLM)
 * had two failure modes:
 *   1. Rule-confident-enough-not-to-ask but actually wrong (e.g. "ăn phở
 *      60k với khách" — "ăn" steers it toward MEAL but the amount makes
 *      EXPENSE more likely). Tier 1 used to swallow these silently. Tier 2
 *      now rechecks them.
 *   2. Low-confidence rule treated as truth when LLM was unavailable. The
 *      new policy returns `needsReview = true` so the UI doesn't pretend
 *      the parser is sure.
 */
import { Injectable } from '@nestjs/common';
import type {
  CaptureAlternative,
  CaptureKind,
  CaptureParseRequest,
  CaptureParseResponse,
  ParserSource,
} from '@lifeos/shared';
import { runRuleParsersAll } from './parsers';
import type { ParseHit } from './parsers/types';
import { OpenAiParser } from './parsers/openai.parser';
import { CorrectionsService } from './corrections.service';

/** Rule confidence above which we trust the rule outright. */
export const STRONG_THRESHOLD = 0.9;
/** Rule confidence below which the parse is too uncertain even for the LLM
 *  to disambiguate from one short sentence — UI must ask the user. */
export const MEDIUM_THRESHOLD = 0.55;
/** Margin by which the LLM must beat the rule to override it in the medium tier. */
const LLM_OVERRIDE_MARGIN = 0.05;

@Injectable()
export class CaptureService {
  constructor(
    private readonly llm: OpenAiParser,
    private readonly corrections: CorrectionsService,
  ) {}

  async parse(userId: string, input: CaptureParseRequest): Promise<CaptureParseResponse> {
    const now = input.nowIso ? new Date(input.nowIso) : new Date();
    const ctx = { now, tz: input.tz };

    const ruleHits = runRuleParsersAll(input.text, ctx);
    const ruleHit = ruleHits[0] ?? null;

    // Tier 1: strong rule wins, no LLM trip. Still surface alternatives
    // because even a confident parser benefits from a "or maybe...?" chip
    // when there's a clear runner-up (e.g. "ăn 60k" hits both EXPENSE and
    // MEAL strongly).
    if (ruleHit && ruleHit.confidence >= STRONG_THRESHOLD) {
      return toResponse(ruleHit, {
        source: 'RULE',
        needsReview: false,
        alternatives: collectAlternatives(ruleHits, ruleHit.kind, null),
      });
    }

    // Tier 2: medium-confidence rule (or no rule but the user has said
    // something parsable). Ask the LLM with few-shot examples drawn from
    // this user's past corrections — they steer the model toward this
    // user's specific vocabulary ("trà sữa Phúc Long" was their EXPENSE,
    // not a brand-name MEAL, etc).
    const recentCorrections = await this.corrections.recentForUser(userId, 5);
    const llmHit = await this.llm.tryParse(userId, input.text, ctx, recentCorrections);

    const winner = pickWinner(ruleHit, llmHit);
    if (winner) {
      // HYBRID when both produced a hit; otherwise whichever single path won.
      const source: ParserSource =
        ruleHit && llmHit ? 'HYBRID' : winner === ruleHit ? 'RULE' : 'OPENAI';
      const needsReview =
        winner.confidence < MEDIUM_THRESHOLD || (source === 'RULE' && !llmHit && winner.confidence < STRONG_THRESHOLD);
      return toResponse(winner, {
        source,
        needsReview,
        alternatives: collectAlternatives(ruleHits, winner.kind, llmHit),
      });
    }

    // Tier 3: nothing came back. UNKNOWN — still offer alternatives if the
    // rule parsers had weak hits we can present as 1-tap fallbacks.
    return {
      kind: 'UNKNOWN',
      source: 'RULE',
      confidence: 0,
      fields: {},
      previewText: '?',
      hint: 'Mình chưa rõ ý — gõ rõ hơn hoặc chọn loại bên dưới.',
      needsReview: true,
      alternatives: collectAlternatives(ruleHits, 'UNKNOWN', null),
    };
  }
}

/**
 * Build up to 3 alternative classifications. Excludes the chosen kind and
 * UNKNOWN; clamps confidence to a 0.3 floor (anything weaker is noise) and
 * ranks by confidence descending. The LLM hit (if any) is included only
 * when its kind differs from the rule winner — gives the UI an "or AI
 * thinks…" option.
 */
function collectAlternatives(
  ruleHits: ParseHit[],
  chosenKind: CaptureKind | 'UNKNOWN',
  llmHit: ParseHit | null,
): CaptureAlternative[] {
  const seen = new Set<string>([chosenKind]);
  const out: CaptureAlternative[] = [];

  if (llmHit && !seen.has(llmHit.kind) && llmHit.kind !== 'UNKNOWN' && llmHit.confidence >= 0.3) {
    out.push(toAlternative(llmHit));
    seen.add(llmHit.kind);
  }
  for (const h of ruleHits) {
    if (out.length >= 3) break;
    if (seen.has(h.kind) || h.kind === 'UNKNOWN' || h.confidence < 0.3) continue;
    out.push(toAlternative(h));
    seen.add(h.kind);
  }
  return out;
}

function toAlternative(hit: ParseHit): CaptureAlternative {
  return {
    kind: hit.kind,
    confidence: Number(hit.confidence.toFixed(3)),
    label: hit.previewText.slice(0, 80),
  };
}

function pickWinner(rule: ParseHit | null, llm: ParseHit | null): ParseHit | null {
  if (!rule && !llm) return null;
  if (!rule) return llm;
  if (!llm) return rule;
  // Defer to the LLM only if it beat the rule by a meaningful margin —
  // otherwise the rule's deterministic regex output is the safer pick.
  if (llm.confidence - rule.confidence >= LLM_OVERRIDE_MARGIN) return llm;
  return rule;
}

function toResponse(
  hit: ParseHit,
  meta: { source: ParserSource; needsReview: boolean; alternatives: CaptureAlternative[] },
): CaptureParseResponse {
  return {
    kind: hit.kind,
    source: meta.source,
    confidence: Number(hit.confidence.toFixed(3)),
    fields: hit.fields,
    previewText: hit.previewText,
    hint: hit.hint,
    needsReview: meta.needsReview,
    alternatives: meta.alternatives,
  };
}
