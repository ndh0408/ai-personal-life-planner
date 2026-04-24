import { useTranslation } from 'react-i18next';

/**
 * Map a backend error payload to a localized user-facing message.
 *
 * The backend returns a stable `errorCode` (e.g. `AUTH_INVALID_CREDENTIALS`)
 * which we use as the translation key under `errors.*`. Unknown codes fall
 * back to `errors.UNKNOWN_ERROR` so we never surface raw backend strings.
 *
 * @example
 *   const translateError = useErrorMessage();
 *   try { await api.post('/auth/login', body); }
 *   catch (e) { setError(translateError(e)); }
 */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (err: unknown): string => {
    if (!err) return t('errors.UNKNOWN_ERROR');

    // ApiError shape from services/api/client.ts + OfflineAiBlocked sentinel
    type ApiErrorLike = {
      status?: number;
      body?: { errorCode?: string } | null;
      message?: string;
      errorCode?: string;
    };
    const maybe = err as ApiErrorLike;
    if (maybe.errorCode === 'AI_OFFLINE') return t('offline.ai.blockedBody');
    const code = maybe.body?.errorCode;
    if (code && t(`errors.${code}`, { defaultValue: '' })) {
      return t(`errors.${code}`);
    }
    if (maybe.status === 0) return t('errors.NETWORK');
    return t('errors.UNKNOWN_ERROR');
  };
}
