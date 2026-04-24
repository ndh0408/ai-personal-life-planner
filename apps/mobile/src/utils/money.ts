/**
 * Money helpers for the mobile app.
 *
 * Decimal values come back from the Prisma-backed API as strings (e.g.
 * `"25000000.00"`) to preserve precision. We convert once to a JS number for
 * display math; for *authoritative* math (budget usage, wallet balance
 * adjustments, saving progress), the server always wins — the mobile app
 * never sends back a computed amount that the server needs to persist.
 *
 * `cleanDigits()` is the input-pipe for money TextInputs: strips everything
 * non-numeric so users can't paste in "1,250.50" and break parsing.
 */

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export function cleanDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export function cleanDecimal(raw: string): string {
  // Strip everything but digits + first dot. Multiple dots collapse to one.
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

export function parseMoneyInput(raw: string): number | undefined {
  const s = cleanDecimal(raw);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
