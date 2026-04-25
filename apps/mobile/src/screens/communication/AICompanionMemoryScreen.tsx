import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge, Chip } from '../../components/ui';
import {
  communicationApi,
  COMPANION_MEMORY_TYPES,
} from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { AiCompanionMemoryTypeDto, MemoryConsentDto } from '@planner/shared';

const CONSENT_KEYS: Array<keyof MemoryConsentDto> = [
  'allowMemory',
  'allowEmailForAI',
  'allowCommunicationContextForAI',
  'allowVoiceNotesForAI',
];

export function AICompanionMemoryScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<AiCompanionMemoryTypeDto | null>(null);

  const memoryQ = useQuery({
    queryKey: QUERY_KEYS.companionMemory,
    queryFn: communicationApi.listMemory,
  });
  const consentQ = useQuery({
    queryKey: QUERY_KEYS.memoryConsent,
    queryFn: communicationApi.getMemoryConsent,
  });

  const consentMut = useMutation({
    mutationFn: communicationApi.updateMemoryConsent,
    onSuccess: (next) => qc.setQueryData<MemoryConsentDto>(QUERY_KEYS.memoryConsent, next),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => communicationApi.deleteMemory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.companionMemory }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const clearAll = useMutation({
    mutationFn: communicationApi.clearAllMemory,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.companionMemory }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  if (memoryQ.isLoading || consentQ.isLoading) return <Loading />;
  if (memoryQ.isError) {
    return <ErrorView message={messageFor(memoryQ.error)} onRetry={() => memoryQ.refetch()} />;
  }

  const items = (memoryQ.data ?? []).filter((m) => !filter || m.memoryType === filter);
  const consent = consentQ.data ?? {
    allowMemory: true,
    allowEmailForAI: false,
    allowCommunicationContextForAI: false,
    allowVoiceNotesForAI: false,
  };

  const onToggleConsent = (key: keyof MemoryConsentDto, value: boolean) => {
    consentMut.mutate({ [key]: value });
  };

  const onClearAll = () => {
    Alert.alert(t('settings.communication.memory.clearAllConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => clearAll.mutate() },
    ]);
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          {t('settings.communication.memory.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('settings.communication.memory.subtitle')}
        </Text>

        {/* Consent toggles */}
        <Text
          style={{
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.communication.memory.consentSection')}
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          {CONSENT_KEYS.map((k, idx, arr) => (
            <View
              key={k}
              style={{
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', flex: 1, paddingRight: 8 }}>
                  {t(`settings.communication.memory.consent.${k}.label`)}
                </Text>
                <Switch
                  value={Boolean(consent[k])}
                  onValueChange={(v) => onToggleConsent(k, v)}
                  disabled={consentMut.isPending}
                />
              </View>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {t(`settings.communication.memory.consent.${k}.hint`)}
              </Text>
            </View>
          ))}
        </Card>

        {/* Filter chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
          <Chip
            label={t('settings.communication.memory.filterAll')}
            selected={filter === null}
            onPress={() => setFilter(null)}
          />
          {COMPANION_MEMORY_TYPES.map((tp) => (
            <Chip
              key={tp}
              label={t(`settings.communication.memory.type.${tp}`)}
              selected={filter === tp}
              onPress={() => setFilter(tp)}
            />
          ))}
        </View>

        {items.length === 0 ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted }}>
              {t('settings.communication.memory.empty')}
            </Text>
          </Card>
        ) : (
          items.map((m) => (
            <Card key={m.id} style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.xs,
                }}
              >
                <Badge tone="info">{t(`settings.communication.memory.type.${m.memoryType}`)}</Badge>
                {!m.isActive ? <Badge tone="danger">{t('common.inactive')}</Badge> : null}
              </View>
              <Text style={{ color: colors.text }}>{m.content}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md }}>
                <Button
                  title={t('common.delete')}
                  variant="ghost"
                  onPress={() => removeMut.mutate(m.id)}
                />
              </View>
            </Card>
          ))
        )}

        <Button
          title={t('settings.communication.memory.clearAll')}
          variant="danger"
          loading={clearAll.isPending}
          onPress={onClearAll}
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}
