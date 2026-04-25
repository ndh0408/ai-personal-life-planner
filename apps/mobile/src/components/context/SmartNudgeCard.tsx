import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Card, Button, Badge } from '../ui';
import { contextApi } from '../../services/api/context.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type {
  ContextInferenceDto,
  ContextInferenceTypeDto,
} from '@planner/shared';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Reusable nudge card. Renderable on Today, Assistant, or any screen that
 * pulls one or more `ContextInferenceDto` rows. Three actions:
 *   - Apply  → dispatches the embedded suggestedAction (when known)
 *   - Got it → status=VIEWED (just acknowledges)
 *   - Dismiss → status=DISMISSED (won't reappear today)
 */
export function SmartNudgeCard({ inference }: { inference: ContextInferenceDto }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: (status: 'DISMISSED' | 'VIEWED' | 'APPLIED') =>
      contextApi.patchStatus(inference.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contextToday }),
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onApply = () => {
    const action = inference.suggestedAction;
    if (!action) {
      updateMut.mutate('APPLIED');
      return;
    }
    // Hand off to the matching dedicated screen — the inference flips to
    // APPLIED so it doesn't reappear today.
    switch (action.type) {
      case 'OPEN_MEAL_QUICK_LOG':
        nav.navigate('MealQuickLog');
        break;
      case 'OPEN_BUDGET_REVIEW':
        nav.navigate('Budget');
        break;
      case 'OPEN_DAILY_REVIEW':
        nav.navigate('DailyReview');
        break;
      case 'RESCHEDULE_LIGHT':
      default:
        // Generic fallback: open the full Smart Context list where the
        // user can also see related nudges.
        nav.navigate('ContextInferences');
        break;
    }
    updateMut.mutate('APPLIED');
  };

  const actionKey = inference.suggestedAction?.type as keyof typeof actionLabels | undefined;
  const actionLabels = {
    RESCHEDULE_LIGHT: t('settings.context.actions.RESCHEDULE_LIGHT'),
    OPEN_MEAL_QUICK_LOG: t('settings.context.actions.OPEN_MEAL_QUICK_LOG'),
    OPEN_BUDGET_REVIEW: t('settings.context.actions.OPEN_BUDGET_REVIEW'),
    OPEN_DAILY_REVIEW: t('settings.context.actions.OPEN_DAILY_REVIEW'),
  } as const;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        }}
      >
        <Badge tone="info">
          {t(`settings.context.type.${inference.type as ContextInferenceTypeDto}`)}
        </Badge>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {Math.round(inference.confidence * 100)}%
        </Text>
      </View>
      {inference.evidence.items.map((it) => (
        <Text key={it.key} style={{ color: colors.text, marginBottom: 4 }}>
          • {it.summary}
        </Text>
      ))}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md, flexWrap: 'wrap' }}>
        {actionKey && actionLabels[actionKey] ? (
          <Button title={actionLabels[actionKey]} onPress={onApply} />
        ) : (
          <Button title={t('settings.context.applied')} onPress={onApply} />
        )}
        <Button
          title={t('settings.context.viewed')}
          variant="ghost"
          onPress={() => updateMut.mutate('VIEWED')}
        />
        <Button
          title={t('settings.context.dismiss')}
          variant="ghost"
          onPress={() => updateMut.mutate('DISMISSED')}
        />
      </View>
    </Card>
  );
}
