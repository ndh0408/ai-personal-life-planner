import { getUserDayBounds, getUserMonthBounds } from './day-bounds';

describe('getUserDayBounds', () => {
  it('returns a 24h window', () => {
    const { from, to } = getUserDayBounds('2026-04-25', 'UTC');
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60_000);
  });

  it('UTC: midnight is at 00:00Z', () => {
    const { from } = getUserDayBounds('2026-04-25', 'UTC');
    expect(from.toISOString()).toBe('2026-04-25T00:00:00.000Z');
  });

  it('Asia/Ho_Chi_Minh (+7): midnight is 17:00Z previous day', () => {
    const { from } = getUserDayBounds('2026-04-25', 'Asia/Ho_Chi_Minh');
    expect(from.toISOString()).toBe('2026-04-24T17:00:00.000Z');
  });

  it('America/Los_Angeles in summer (-7): midnight is 07:00Z same day', () => {
    // 2026-04-25 falls in PDT (UTC-7).
    const { from } = getUserDayBounds('2026-04-25', 'America/Los_Angeles');
    expect(from.toISOString()).toBe('2026-04-25T07:00:00.000Z');
  });

  it('window stays exactly 24h across DST transitions', () => {
    // DST starts 2026-03-08 at 02:00 PST → 03:00 PDT.
    const { from, to } = getUserDayBounds('2026-03-08', 'America/Los_Angeles');
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60_000);
  });
});

describe('getUserMonthBounds', () => {
  it('UTC April 2026', () => {
    const { from, to } = getUserMonthBounds('2026-04', 'UTC');
    expect(from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('rolls year on December', () => {
    const { from, to } = getUserMonthBounds('2026-12', 'UTC');
    expect(from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('Asia/Ho_Chi_Minh: month start is 17:00Z previous day', () => {
    const { from } = getUserMonthBounds('2026-04', 'Asia/Ho_Chi_Minh');
    expect(from.toISOString()).toBe('2026-03-31T17:00:00.000Z');
  });

  it('rejects malformed month', () => {
    expect(() => getUserMonthBounds('2026-13', 'UTC')).toThrow();
  });
});
