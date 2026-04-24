export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'vi';

export function normalizeLocale(raw: string | null | undefined): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const tag = raw.toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag)
    ? (tag as SupportedLocale)
    : DEFAULT_LOCALE;
}

export function pickFromAcceptLanguage(header: string | undefined): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;
  const items = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim(), q: q ? Number(q) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of items) {
    const norm = normalizeLocale(tag);
    if (norm !== DEFAULT_LOCALE || tag.toLowerCase().startsWith('vi')) return norm;
  }
  return DEFAULT_LOCALE;
}
