import { runRuleParsers } from './index';
import { findMoney } from './money';

const NOW = new Date('2026-04-26T12:00:00.000Z'); // 19:00 ICT
const TZ = 'Asia/Ho_Chi_Minh';
const ctx = { now: NOW, tz: TZ };

describe('Money parser', () => {
  it.each([
    ['ăn phở 60k', 60_000],
    ['cà phê 55 nghìn', 55_000],
    ['cơm tấm 75000đ', 75_000],
    ['mua sách 1tr', 1_000_000],
    ['xe 1.5tr', 1_500_000],
    ['internet 240.000', 240_000],
    ['lương 22 triệu', 22_000_000],
    ['nạp thẻ 100k vnđ', 100_000],
  ])('extracts amount from %p', (text, expected) => {
    const m = findMoney(text);
    expect(m).not.toBeNull();
    expect(m!.amount).toBe(expected);
  });

  it('rejects bare small numbers (likely time, not price)', () => {
    expect(findMoney('lúc 8 giờ')).toBeNull();
  });
});

describe('Expense parser', () => {
  it('classifies "ăn cơm tấm 75k" as EXPENSE', () => {
    const hit = runRuleParsers('ăn cơm tấm 75k', ctx);
    expect(hit?.kind).toBe('EXPENSE');
    expect(hit?.fields.amount).toBe(75_000);
    expect(hit?.fields.category).toBe('food');
    expect(hit?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies "grab về nhà 48k" as EXPENSE / transport', () => {
    const hit = runRuleParsers('grab về nhà 48k', ctx);
    expect(hit?.kind).toBe('EXPENSE');
    expect(hit?.fields.category).toBe('transport');
    expect(hit?.fields.amount).toBe(48_000);
  });

  it('classifies "mua sách 240k" as EXPENSE / learning', () => {
    const hit = runRuleParsers('mua sách 240k', ctx);
    expect(hit?.kind).toBe('EXPENSE');
    expect(hit?.fields.category).toBe('learning');
  });

  it('strips trigger verb from title', () => {
    const hit = runRuleParsers('ăn phở bò 65k', ctx);
    expect(hit?.fields.title).toMatch(/Phở/i);
  });
});

describe('Meal parser', () => {
  it('classifies "ăn sáng bánh mì" as MEAL / BREAKFAST', () => {
    const hit = runRuleParsers('ăn sáng bánh mì trứng', ctx);
    expect(hit?.kind).toBe('MEAL');
    expect(hit?.fields.mealType).toBe('BREAKFAST');
  });

  it('classifies "ăn trưa cơm tấm" as MEAL / LUNCH (no money beats expense)', () => {
    const hit = runRuleParsers('ăn trưa cơm tấm', ctx);
    expect(hit?.kind).toBe('MEAL');
    expect(hit?.fields.mealType).toBe('LUNCH');
  });

  it('classifies "ăn tối cơm nhà" as MEAL / DINNER', () => {
    const hit = runRuleParsers('ăn tối cơm nhà', ctx);
    expect(hit?.kind).toBe('MEAL');
    expect(hit?.fields.mealType).toBe('DINNER');
    expect(hit?.fields.cost).toBeNull();
  });
});

describe('Task parser', () => {
  it('classifies "họp với An lúc 3h chiều" as TASK with dueAt', () => {
    const hit = runRuleParsers('họp với An lúc 3h chiều', ctx);
    expect(hit?.kind).toBe('TASK');
    expect(hit?.fields.dueAtIso).toBeDefined();
    const due = new Date(hit!.fields.dueAtIso as string);
    // 3h chiều = 15:00 local; in UTC that's 08:00.
    expect(due.getUTCHours()).toBe(8);
  });

  it('classifies "gọi mẹ tối nay" as TASK', () => {
    const hit = runRuleParsers('gọi mẹ tối nay', ctx);
    expect(hit?.kind).toBe('TASK');
  });

  it('marks "deadline gấp" as HIGH priority', () => {
    const hit = runRuleParsers('làm slide deadline gấp', ctx);
    expect(hit?.kind).toBe('TASK');
    expect(hit?.fields.priority).toBe('HIGH');
  });
});

describe('Sleep parser', () => {
  it('classifies "ngủ 7 tiếng tối qua" as SLEEP', () => {
    const hit = runRuleParsers('ngủ 7 tiếng tối qua', ctx);
    expect(hit?.kind).toBe('SLEEP');
    expect(hit?.fields.durationMinutes).toBe(7 * 60);
    expect(hit?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses fractional hours "ngủ 6.5 tiếng"', () => {
    const hit = runRuleParsers('ngủ 6.5 tiếng', ctx);
    expect(hit?.kind).toBe('SLEEP');
    expect(hit?.fields.durationMinutes).toBe(390);
  });

  it('marks "ngủ ngon" as quality=GOOD', () => {
    const hit = runRuleParsers('ngủ 7 tiếng ngon', ctx);
    expect(hit?.fields.quality).toBe('GOOD');
  });
});

describe('Mood parser', () => {
  it('classifies "mood vui" as MOOD / GOOD', () => {
    const hit = runRuleParsers('mood vui', ctx);
    expect(hit?.kind).toBe('MOOD');
    expect(hit?.fields.mood).toBe('GOOD');
  });

  it('classifies "cảm thấy mệt" as MOOD / TIRED', () => {
    const hit = runRuleParsers('cảm thấy mệt quá', ctx);
    expect(hit?.kind).toBe('MOOD');
    expect(hit?.fields.mood).toBe('TIRED');
  });

  it('classifies "stress quá" as MOOD / STRESSED', () => {
    const hit = runRuleParsers('hôm nay stress quá', ctx);
    expect(hit?.kind).toBe('MOOD');
    expect(hit?.fields.mood).toBe('STRESSED');
  });
});

describe('Orchestrator (highest confidence wins)', () => {
  it('"ăn phở 60k" → EXPENSE beats MEAL when money present', () => {
    const hit = runRuleParsers('ăn phở 60k', ctx);
    expect(hit?.kind).toBe('EXPENSE');
  });

  it('"ăn sáng" with no money → MEAL', () => {
    const hit = runRuleParsers('ăn sáng', ctx);
    expect(hit?.kind).toBe('MEAL');
  });

  it('"ngẫu nhiên gibberish" → null (will fall back to OpenAI/UNKNOWN)', () => {
    const hit = runRuleParsers('xyzzy frobnicate', ctx);
    expect(hit).toBeNull();
  });
});
