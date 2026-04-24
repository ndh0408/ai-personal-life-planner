import { Alert } from 'react-native';
import { networkStatus } from './network-status';
import i18n from '../../i18n';

/**
 * Returns `true` if the caller can proceed with an AI request, `false`
 * after showing a localized offline alert.
 *
 * AI endpoints are never queued — the user needs a live response + the
 * cost of running stale generation hours after the fact is high. Product
 * rule: refuse fast, explain clearly.
 */
export function requireOnlineForAi(): boolean {
  if (networkStatus.get()) return true;
  Alert.alert(i18n.t('offline.ai.blockedTitle'), i18n.t('offline.ai.blockedBody'));
  return false;
}
