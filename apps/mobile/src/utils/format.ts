/**
 * Money: API ships integers in the smallest unit (đồng for VND). Format to
 * the local convention via Intl.NumberFormat — RN includes Hermes Intl.
 */
export function formatMoney(amount: number, currency = 'VND', locale = 'vi-VN'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount);
  } catch {
    // Hermes Intl can be missing on very old devices — fall back gracefully.
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/** "vừa xong" / "5 phút trước" / "hôm qua" — minimal relative time. */
export function relativeTime(iso: string, locale: 'vi' | 'en', now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.round((now - t) / 1000);
  const m = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  if (diffSec < 30) return m('vừa xong', 'just now');
  if (diffSec < 3600) {
    const mins = Math.round(diffSec / 60);
    return m(`${mins} phút trước`, `${mins} min ago`);
  }
  if (diffSec < 86400) {
    const hrs = Math.round(diffSec / 3600);
    return m(`${hrs} giờ trước`, `${hrs}h ago`);
  }
  const days = Math.round(diffSec / 86400);
  return m(`${days} ngày trước`, `${days}d ago`);
}
