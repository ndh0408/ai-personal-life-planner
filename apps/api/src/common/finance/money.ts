import { Prisma } from '@prisma/client';

/**
 * Decimal-safe money primitives.
 *
 * Why a wrapper instead of using `new Prisma.Decimal(...)` everywhere?
 *  - One import surface for finance services and tests.
 *  - Centralised guards against `NaN`, `Infinity`, and >1e13 monstrosities so
 *    a bad input from anywhere fails fast with a known errorCode.
 *  - The serializer below is the single point that flips a `Decimal` back
 *    into a JSON-safe representation. Today: a `string` to preserve cents
 *    losslessly. Mobile parses with a tolerant Number(...) — fine for
 *    display because amounts cap at 1e13 (well under Number.MAX_SAFE_INTEGER).
 */

/** Maximum permitted money magnitude (matches the .max(1e13) Zod caps). */
export const MAX_MONEY = new Prisma.Decimal('10000000000000');

export class MoneyError extends Error {
  constructor(message: string, public readonly errorCode: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Build a Prisma.Decimal from any input we accept on the wire (number, string,
 * or already-Decimal). Throws `MoneyError('UNPROCESSABLE')` for NaN, Infinity,
 * or magnitudes outside `[0, 1e13]`.
 */
export function money(input: number | string | Prisma.Decimal): Prisma.Decimal {
  let dec: Prisma.Decimal;
  try {
    dec = input instanceof Prisma.Decimal ? input : new Prisma.Decimal(input);
  } catch {
    throw new MoneyError('Invalid money value', 'UNPROCESSABLE');
  }
  if (!dec.isFinite()) {
    throw new MoneyError('Money must be finite', 'UNPROCESSABLE');
  }
  if (dec.isNegative()) {
    throw new MoneyError('Money must be >= 0', 'UNPROCESSABLE');
  }
  if (dec.greaterThan(MAX_MONEY)) {
    throw new MoneyError('Money exceeds maximum allowed magnitude', 'UNPROCESSABLE');
  }
  return dec;
}

/** Same as `money()` but allows zero / positive *and* zero. */
export function moneyOrZero(input: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (input === null || input === undefined) return new Prisma.Decimal(0);
  return money(input);
}

/** Sum a list of Decimal-or-string-or-number values without IEEE drift. */
export function sumMoney(values: Array<number | string | Prisma.Decimal | null | undefined>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => {
    if (v === null || v === undefined) return acc;
    const dec = v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
    return acc.plus(dec);
  }, new Prisma.Decimal(0));
}

/**
 * Serialise a Decimal for the JSON wire. Returns a fixed-2 string so the
 * client doesn't accidentally `JSON.parse` cents off a too-big number.
 *
 * Use the `Number(serialiseMoney(x))` shortcut from mobile only when the
 * caller is OK with lossy display (we are — amounts cap at 1e13).
 */
export function serialiseMoney(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  const dec = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return dec.toFixed(2);
}

/**
 * Decimal-safe ratio (used by budgets/usage %). Returns 0 when denominator
 * is zero so the caller doesn't have to keep guarding.
 */
export function pctOf(part: Prisma.Decimal | number | string, whole: Prisma.Decimal | number | string): number {
  const p = part instanceof Prisma.Decimal ? part : new Prisma.Decimal(part);
  const w = whole instanceof Prisma.Decimal ? whole : new Prisma.Decimal(whole);
  if (w.isZero()) return 0;
  return Number(p.times(100).dividedBy(w).toFixed(2));
}

/**
 * Compare two Decimal-likes for "essentially equal at 2dp" — convenient when
 * an external API or mobile sent a slightly-rounded amount.
 */
export function approxEqual(
  a: Prisma.Decimal | number | string,
  b: Prisma.Decimal | number | string,
  toleranceCents = 1,
): boolean {
  const ad = a instanceof Prisma.Decimal ? a : new Prisma.Decimal(a);
  const bd = b instanceof Prisma.Decimal ? b : new Prisma.Decimal(b);
  return ad.minus(bd).abs().lessThanOrEqualTo(new Prisma.Decimal(toleranceCents).dividedBy(100));
}
