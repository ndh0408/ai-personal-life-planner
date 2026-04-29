import { formatMoney, relativeTime } from './format';

describe('formatMoney', () => {
  it('formats VND with no decimal places', () => {
    const out = formatMoney(60_000);
    expect(out).toMatch(/60[.,]?000/);
    expect(out).toMatch(/₫|VND/);
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toMatch(/0/);
  });

  it('falls back gracefully when Intl chokes on a bogus currency', () => {
    expect(() => formatMoney(100, 'NOTACURRENCY')).not.toThrow();
  });
});

describe('relativeTime', () => {
  const NOW = Date.parse('2026-04-29T12:00:00Z');

  it('returns "vừa xong" within 30 s', () => {
    const iso = new Date(NOW - 5_000).toISOString();
    expect(relativeTime(iso, 'vi', NOW)).toBe('vừa xong');
  });

  it('returns minutes between 1m and 1h', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(relativeTime(iso, 'vi', NOW)).toBe('5 phút trước');
  });

  it('returns hours between 1h and 24h', () => {
    const iso = new Date(NOW - 3 * 3600_000).toISOString();
    expect(relativeTime(iso, 'vi', NOW)).toBe('3 giờ trước');
  });

  it('returns days for older timestamps', () => {
    const iso = new Date(NOW - 2 * 86400_000).toISOString();
    expect(relativeTime(iso, 'vi', NOW)).toBe('2 ngày trước');
  });

  it('honours the en locale', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(relativeTime(iso, 'en', NOW)).toBe('5 min ago');
  });
});
