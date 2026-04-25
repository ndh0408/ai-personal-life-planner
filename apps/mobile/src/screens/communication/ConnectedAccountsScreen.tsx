import React from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge } from '../../components/ui';
import { communicationApi } from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { ConnectedAccountDto } from '@planner/shared';

export function ConnectedAccountsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: QUERY_KEYS.connectedAccounts,
    queryFn: communicationApi.listAccounts,
  });

  const startGmail = useMutation({
    mutationFn: communicationApi.startGmailOAuth,
    onSuccess: (r) => Linking.openURL(r.authorizeUrl),
    onError: (e) =>
      Alert.alert(
        t('settings.communication.accounts.title'),
        // The backend returns OAUTH_NOT_CONFIGURED for now — translate that
        // into the friendly "coming in v1.3" copy.
        messageFor(e) || t('settings.communication.accounts.oauthNotConfigured'),
      ),
  });

  const startOutlook = useMutation({
    mutationFn: communicationApi.startOutlookOAuth,
    onSuccess: (r) => Linking.openURL(r.authorizeUrl),
    onError: (e) =>
      Alert.alert(
        t('settings.communication.accounts.title'),
        messageFor(e) || t('settings.communication.accounts.oauthNotConfigured'),
      ),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => communicationApi.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.connectedAccounts }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onDisconnect = (a: ConnectedAccountDto) => {
    Alert.alert(
      t('settings.communication.accounts.disconnectConfirm'),
      t('settings.communication.accounts.disconnectBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => disconnect.mutate(a.id),
        },
      ],
    );
  };

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorView message={messageFor(q.error)} onRetry={() => q.refetch()} />;
  }

  const items = q.data ?? [];

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.communication.accounts.title')}
        </Text>

        {items.length === 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.communication.accounts.empty')}
            </Text>
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id} style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{a.email}</Text>
                <Badge tone={a.isActive ? 'success' : 'danger'}>{a.provider}</Badge>
              </View>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {a.lastSyncedAt
                  ? `${t('settings.communication.accounts.lastSynced')}: ${new Date(a.lastSyncedAt).toLocaleString()}`
                  : t('settings.communication.accounts.neverSynced')}
              </Text>
              <Button
                title={t('settings.communication.accounts.disconnect')}
                variant="danger"
                style={{ marginTop: spacing.sm }}
                onPress={() => onDisconnect(a)}
              />
            </Card>
          ))
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title={t('settings.communication.accounts.connectGmail')}
            onPress={() => startGmail.mutate()}
            loading={startGmail.isPending}
          />
          <Button
            title={t('settings.communication.accounts.connectOutlook')}
            variant="secondary"
            onPress={() => startOutlook.mutate()}
            loading={startOutlook.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
