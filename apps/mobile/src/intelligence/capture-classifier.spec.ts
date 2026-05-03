import { classifyCapture } from './capture-classifier';

describe('classifyCapture (on-device stub)', () => {
  it('returns UNKNOWN for empty input', () => {
    expect(classifyCapture('').kind).toBe('UNKNOWN');
  });

  it('classifies VN expenses with verb + amount', () => {
    expect(classifyCapture('mua cà phê 35k').kind).toBe('EXPENSE');
    expect(classifyCapture('trả tiền điện 320000').kind).toBe('EXPENSE');
  });

  it('classifies VN income', () => {
    expect(classifyCapture('nhận lương 25000000').kind).toBe('INCOME');
  });

  it('classifies EN expenses', () => {
    expect(classifyCapture('paid for coffee 4.50').kind).toBe('EXPENSE');
  });

  it('amount alone defaults to EXPENSE with mid confidence', () => {
    const r = classifyCapture('300k');
    expect(r.kind).toBe('EXPENSE');
    expect(r.confidence).toBeLessThan(0.7);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('classifies tasks', () => {
    expect(classifyCapture('nhớ gọi cho mẹ').kind).toBe('TASK');
    expect(classifyCapture('need to email Daisy').kind).toBe('TASK');
  });

  it('classifies events with explicit time', () => {
    expect(classifyCapture('hẹn gặp khách lúc 3h chiều').kind).toBe('EVENT');
    expect(classifyCapture('meeting at 5pm with the team').kind).toBe('EVENT');
  });

  it('classifies sleep / mood / meal', () => {
    expect(classifyCapture('ngủ 7 tiếng').kind).toBe('SLEEP');
    expect(classifyCapture('cảm thấy mệt mỏi').kind).toBe('MOOD');
    expect(classifyCapture('ăn trưa phở bò').kind).toBe('MEAL');
  });

  it('long free-form text falls back to NOTE', () => {
    const r = classifyCapture('hôm nay có ánh nắng đẹp ngoài cửa sổ');
    expect(r.kind).toBe('NOTE');
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('short ambiguous text returns UNKNOWN', () => {
    expect(classifyCapture('ok').kind).toBe('UNKNOWN');
  });
});
