import { CaptureService, MEDIUM_THRESHOLD, STRONG_THRESHOLD } from './capture.service';
import type { OpenAiParser } from './parsers/openai.parser';
import type { CorrectionsService } from './corrections.service';
import type { ParseHit } from './parsers/types';

// Replace runRuleParsers with a stub so each test controls the rule outcome.
jest.mock('./parsers', () => ({
  runRuleParsers: jest.fn(),
}));
import { runRuleParsers } from './parsers';

const TZ = 'Asia/Ho_Chi_Minh';

function expenseHit(confidence: number, source: 'RULE' | 'OPENAI' = 'RULE'): ParseHit {
  return {
    kind: 'EXPENSE',
    source,
    confidence,
    fields: { title: 'phở', amount: 60_000, currency: 'VND', category: 'food', expenseDateIso: new Date().toISOString() },
    previewText: '💸 phở',
  };
}

function makeService(overrides?: { llmReturn?: ParseHit | null; corrections?: unknown[] }) {
  const llm = {
    tryParse: jest.fn(async () => overrides?.llmReturn ?? null),
  } as unknown as OpenAiParser;
  const corrections = {
    recentForUser: jest.fn(async () => overrides?.corrections ?? []),
  } as unknown as CorrectionsService;
  return { svc: new CaptureService(llm, corrections), llm, corrections };
}

describe('CaptureService — three-tier routing', () => {
  beforeEach(() => {
    (runRuleParsers as jest.Mock).mockReset();
  });

  it(`tier 1 — strong rule (≥ ${STRONG_THRESHOLD}) skips LLM`, async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(expenseHit(0.92));
    const { svc, llm } = makeService();
    const out = await svc.parse('u1', { text: 'ăn phở 60k', tz: TZ });
    expect(out.kind).toBe('EXPENSE');
    expect(out.source).toBe('RULE');
    expect(out.needsReview).toBe(false);
    expect(llm.tryParse).not.toHaveBeenCalled();
  });

  it('tier 2 — medium rule confidence triggers LLM call', async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(expenseHit(0.7));
    const llmHit = expenseHit(0.85, 'OPENAI');
    const { svc, llm } = makeService({ llmReturn: llmHit });
    const out = await svc.parse('u1', { text: 'ăn phở 60k với khách', tz: TZ });
    expect(llm.tryParse).toHaveBeenCalled();
    // LLM beat rule by 0.15 (> margin 0.05) → HYBRID, picked LLM
    expect(out.source).toBe('HYBRID');
    expect(out.needsReview).toBe(false);
  });

  it('tier 2 — LLM only nudges (within margin) keeps rule', async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(expenseHit(0.8));
    const llmHit = expenseHit(0.82, 'OPENAI');
    const { svc } = makeService({ llmReturn: llmHit });
    const out = await svc.parse('u1', { text: 'phở 60k', tz: TZ });
    // Diff 0.02 < margin 0.05 → keep rule, but report HYBRID since LLM was consulted
    expect(out.source).toBe('HYBRID');
  });

  it('tier 2 — LLM unavailable + medium rule = needsReview', async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(expenseHit(0.6));
    const { svc } = makeService({ llmReturn: null });
    const out = await svc.parse('u1', { text: 'mơ hồ', tz: TZ });
    expect(out.source).toBe('RULE');
    expect(out.needsReview).toBe(true);
  });

  it(`tier 3 — rule below ${MEDIUM_THRESHOLD} and no LLM = UNKNOWN + needsReview`, async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(null);
    const { svc } = makeService({ llmReturn: null });
    const out = await svc.parse('u1', { text: '???', tz: TZ });
    expect(out.kind).toBe('UNKNOWN');
    expect(out.needsReview).toBe(true);
  });

  it('passes recent corrections to the LLM call', async () => {
    (runRuleParsers as jest.Mock).mockReturnValue(expenseHit(0.7));
    const corrections = [{ rawText: 'trà sữa 60k', originalKind: 'MEAL', correctedKind: 'EXPENSE' }];
    const { svc, llm } = makeService({ llmReturn: expenseHit(0.85, 'OPENAI'), corrections });
    await svc.parse('u1', { text: 'trà sữa 60k', tz: TZ });
    expect(llm.tryParse).toHaveBeenCalledWith('u1', 'trà sữa 60k', expect.anything(), corrections);
  });
});
