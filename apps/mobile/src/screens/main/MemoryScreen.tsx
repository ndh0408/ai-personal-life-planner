/**
 * Memory pane — surfaces what the Assistant has remembered about the user.
 * Round 18 introduces persistent facts ("user prefers cơm gà over phở", etc.)
 * that the AI extracts from chat. Showing them honours the privacy promise:
 * the user can audit + delete any fact they don't want kept.
 */
import React from 'react';
import { RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Text,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { memoryService } from '../../services/api/profile.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

export function MemoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const list = useQuery({
    queryKey: ['memory'],
    queryFn: () => memoryService.list(),
  });

  const forget = useMutation({
    mutationFn: (id: string) => memoryService.forget(id),
    onSuccess: () => {
      toast.show(t('memory.forgotten'), 'success');
      qc.invalidateQueries({ queryKey: ['memory'] });
    },
  });

  const refreshing = list.isFetching && !list.isLoading;

  return (
    <AppScreen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => list.refetch()} />}
    >
      <AppHeader
        kicker={t('memory.kicker')}
        title={t('memory.title')}
        onBack={() => navigation.goBack()}
      />
      <Text style={{ marginBottom: spacing.xl, opacity: 0.7 }}>{t('memory.subtitle')}</Text>

      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.length === 0 ? <EmptyState title={t('memory.empty')} /> : null}

      <View style={{ gap: spacing.md }}>
        {list.data?.map((m) => (
          <Card key={m.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Icon name="checkmark-circle-outline" size={18} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyEm">{m.fact}</Text>
                <Text variant="caption" style={{ marginTop: 2, opacity: 0.7 }}>
                  {m.kind} · {Math.round(m.weight * 100)}%
                </Text>
              </View>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={t('memory.forget')}
                variant="ghost"
                size="md"
                onPress={() => forget.mutate(m.id)}
                disabled={forget.isPending}
              />
            </View>
          </Card>
        ))}
      </View>
    </AppScreen>
  );
}
