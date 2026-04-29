import { ApiHttpError, NetworkError } from '../services/api/errors';

export type ErrorNamespace =
  | 'auth'
  | 'onboarding'
  | 'onboarding.aiSetup'
  | 'assistant'
  | 'capture'
  | 'common';

/**
 * Map a thrown error → i18n key under the given namespace.
 * Caller falls back to "<ns>.errors.unknown" if the specific code isn't translated.
 */
export function errorI18nKey(e: unknown, ns: ErrorNamespace = 'auth'): string {
  if (e instanceof NetworkError) return `${ns}.errors.network`;
  if (e instanceof ApiHttpError) return `${ns}.errors.${e.errorCode}`;
  return `${ns}.errors.unknown`;
}

export function readableError(
  e: unknown,
  t: (k: string) => string,
  ns: ErrorNamespace = 'auth',
): string {
  const key = errorI18nKey(e, ns);
  const candidate = t(key);
  if (candidate !== key) return candidate;
  const fallback = t(`${ns}.errors.unknown`);
  if (fallback !== `${ns}.errors.unknown`) return fallback;
  return t('common.errorBody');
}
