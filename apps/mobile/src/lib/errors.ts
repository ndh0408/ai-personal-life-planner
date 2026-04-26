import { ApiHttpError, NetworkError } from '../api/client';

/**
 * Maps a thrown error into the i18n key under the given namespace.
 * `auth.errors.<code>` and `aiSetup.errors.<code>` are the two catalogs we use;
 * unknown codes fall back to `<namespace>.errors.unknown` if present, else
 * `auth.errors.unknown`.
 */
export function errorI18nKey(e: unknown, namespace: 'auth' | 'aiSetup'): string {
  if (e instanceof NetworkError) return `${namespace}.errors.network`;
  if (e instanceof ApiHttpError) {
    return `${namespace}.errors.${e.errorCode}`;
  }
  return `${namespace}.errors.unknown`;
}

export function readableError(
  e: unknown,
  t: (k: string) => string,
  namespace: 'auth' | 'aiSetup',
): string {
  // Try the specific code, fall back to the namespace's "unknown", then to "auth.errors.unknown".
  const key = errorI18nKey(e, namespace);
  const candidate = t(key);
  if (candidate !== key) return candidate;

  const fallbackKey = `${namespace}.errors.unknown`;
  const fallback = t(fallbackKey);
  if (fallback !== fallbackKey) return fallback;

  return t('auth.errors.unknown');
}
