import { getActiveLocale } from '../i18n';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTimeOfDay(value: string | Date | null | undefined): string {
  if (!value) return '--:--';
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
}

export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ---- locale-aware helpers mandated by the product spec ---------------------

export function getCurrentLocale(): string {
  return getActiveLocale();
}

function toBcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'en') return 'en-US';
  return locale;
}

export function formatDateByLocale(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(toBcp47(getActiveLocale()), {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

export function formatTimeByLocale(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(toBcp47(getActiveLocale()), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Locale-aware money formatter.
 *
 * Decimal values from Prisma arrive as strings over the wire; accept both.
 * Defaults to VND when currency is omitted (the product's default currency).
 */
export function formatMoneyByLocale(
  amount: number | string | null | undefined,
  currency: string = 'VND',
): string {
  if (amount === null || amount === undefined) return '';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(num)) return '';
  try {
    return new Intl.NumberFormat(toBcp47(getActiveLocale()), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(num);
  } catch {
    return `${num.toLocaleString(toBcp47(getActiveLocale()))} ${currency}`;
  }
}

/** Compact-money: 1.2M VND, $34k — used on tight cards. */
export function formatMoneyCompact(
  amount: number | string | null | undefined,
  currency: string = 'VND',
): string {
  if (amount === null || amount === undefined) return '';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(num)) return '';
  try {
    return new Intl.NumberFormat(toBcp47(getActiveLocale()), {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return formatMoneyByLocale(num, currency);
  }
}
