import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { userAiProvidersApi } from '../services/api/user-ai-providers.api';
import { QUERY_KEYS } from '../constants';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Read-only "is AI enabled?" indicator backed by the providers query.
 *
 * AI is considered enabled when the user has at least one provider row
 * AND the resolved preference favours their own key (default once
 * `createOpenAiSimple` has run). The hook does not trigger a fetch on
 * its own — it piggybacks on the existing `aiProviders` cache.
 */
export function useAiEnabled(): {
  enabled: boolean;
  loading: boolean;
} {
  const q = useQuery({
    queryKey: QUERY_KEYS.aiProviders,
    queryFn: userAiProvidersApi.list,
    staleTime: 60_000,
  });
  return {
    enabled: (q.data ?? []).some((p) => p.isActive),
    loading: q.isLoading,
  };
}

/**
 * Imperative gate — call from any AI-feature button. If the user has
 * not configured a provider yet, prompts them to do so and routes to
 * `AISetupScreen`. Returns `true` when the caller may proceed; `false`
 * when the gate intercepted.
 *
 * Usage:
 *   const guardAi = useAiGate();
 *   const onPress = () => { if (!guardAi()) return; aiApi.chat(...); };
 */
export function useAiGate(): () => boolean {
  const { enabled, loading } = useAiEnabled();
  const nav = useNavigation<Nav>();
  const { t } = useTranslation();

  return () => {
    if (loading) return true; // optimistic — let caller proceed; backend will gate
    if (enabled) return true;
    Alert.alert(
      t('errors.AI_PROVIDER_NOT_CONFIGURED'),
      t('settings.aiSetup.noKeyBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.aiSetup.addKey'),
          onPress: () => nav.navigate('AISetup'),
        },
      ],
    );
    return false;
  };
}
