import { Prisma } from '@prisma/client';
import {
  approxEqual,
  money,
  moneyOrZero,
  MoneyError,
  pctOf,
  serialiseMoney,
  sumMoney,
} from './money';

describe('money()', () => {
  it('accepts a positive number', () => {
    expect(money(100).toFixed(2)).toBe('100.00');
  });

  it('accepts a numeric string', () => {
    expect(money('1234.56').toFixed(2)).toBe('1234.56');
  });

  it('rejects NaN', () => {
    expect(() => money(NaN as unknown as number)).toThrow(MoneyError);
  });

  it('rejects Infinity', () => {
    expect(() => money(Infinity as unknown as number)).toThrow(MoneyError);
  });

  it('rejects negative', () => {
    expect(() => money(-1)).toThrow(MoneyError);
  });

  it('rejects above 1e13', () => {
    expect(() => money('99999999999999')).toThrow(MoneyError);
  });
});

describe('moneyOrZero()', () => {
  it('returns 0 for null', () => {
    expect(moneyOrZero(null).toFixed(2)).toBe('0.00');
  });

  it('returns 0 for undefined', () => {
    expect(moneyOrZero(undefined).toFixed(2)).toBe('0.00');
  });
});

describe('sumMoney()', () => {
  it('sums Decimal-safely without IEEE drift', () => {
    // Classic case: 0.1 + 0.2 should be 0.30 exactly.
    const r = sumMoney(['0.1', '0.2']);
    expect(r.toFixed(2)).toBe('0.30');
  });

  it('skips null/undefined entries', () => {
    expect(sumMoney([1, null, 2, undefined, 3]).toFixed(2)).toBe('6.00');
  });
});

describe('serialiseMoney()', () => {
  it('produces fixed-2 string', () => {
    expect(serialiseMoney(new Prisma.Decimal('1234567890.5'))).toBe('1234567890.50');
  });

  it('handles null/undefined', () => {
    expect(serialiseMoney(null)).toBe('0.00');
    expect(serialiseMoney(undefined)).toBe('0.00');
  });
});

describe('pctOf()', () => {
  it('returns 0 when whole is zero', () => {
    expect(pctOf(10, 0)).toBe(0);
  });

  it('rounds to 2dp', () => {
    expect(pctOf(1, 3)).toBe(33.33);
  });
});

describe('approxEqual()', () => {
  it('treats one-cent gaps as equal', () => {
    expect(approxEqual('100.01', '100.00')).toBe(true);
  });

  it('rejects two-cent gap with default tolerance', () => {
    expect(approxEqual('100.02', '100.00')).toBe(false);
  });
});
