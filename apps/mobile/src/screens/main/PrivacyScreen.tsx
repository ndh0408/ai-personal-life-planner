/**
 * Privacy controls — round 23 surface for the round-20 PrivacySetting API.
 *
 * Each toggle is a domain the AI features will or won't see in the
 * LifeSnapshot. Disabling a flag never deletes data; it just stops that
 * domain from entering AI context. Saving immediately invalidates the
 * server-side snapshot cache, so the next assistant turn (or planner run)
 * reflects the new flags within milliseconds.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, AppScreen, Card, Text, useToast } from '../../components/ui';
import { spacing, colors, radius } from '../../theme';
import {
  privacyService,
  type PrivacySettingPublic,
  type UpdatePrivacyRequest,
} from '../../services/api/privacy.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacy'>;

type Flag = keyof Omit<PrivacySettingPublic, 'updatedAt'>;

const FLAGS: { key: Flag; titleKey: string; bodyKey: string }[] = [
  {
    key: 'personalizationEnabled',
    titleKey: 'privacy.personalization.title',
    bodyKey: 'privacy.personalization.body',
  },
  { key: 'useFinanceForAI', titleKey: 'privacy.finance.title', bodyKey: 'privacy.finance.body' },
  { key: 'useHealthForAI', titleKey: 'privacy.health.title', bodyKey: 'privacy.health.body' },
  { key: 'useMealsForAI', titleKey: 'privacy.meals.title', bodyKey: 'privacy.meals.body' },
  { key: 'useTasksForAI', titleKey: 'privacy.tasks.title', bodyKey: 'privacy.tasks.body' },
  { key: 'aiMemoryEnabled', titleKey: 'privacy.memory.title', bodyKey: 'privacy.memory.body' },
  {
    key: 'proactiveRecommendations',
    titleKey: 'privacy.proactive.title',
    bodyKey: 'privacy.proactive.body',
  },
];

export function PrivacyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const settings = useQuery({
    queryKey: ['privacy'],
    queryFn: () => privacyService.get(),
  });

  const [local, setLocal] = useState<PrivacySettingPublic | null>(null);
  useEffect(() => {
    if (settings.data) setLocal(settings.data);
  }, [settings.data]);

  const update = useMutation({
    mutationFn: (req: UpdatePrivacyRequest) => privacyService.update(req),
    onSuccess: (next) => {
      setLocal(next);
      qc.setQueryData(['privacy'], next);
      // Privacy changes affect snapshot — drop everything that reads from it.
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['recommendations'] });
      qc.invalidateQueries({ queryKey: ['daily-plan'] });
      toast.show(
        t('privacy.savedToast', { defaultValue: 'Đã cập nhật quyền riêng tư' }),
        'success',
      );
    },
    onError: () => {
      toast.show(t('common.error', { defaultValue: 'Đã xảy ra lỗi' }), 'danger');
    },
  });

  const toggle = (key: Flag) => {
    if (!local) return;
    const next = { ...local, [key]: !local[key] };
    setLocal(next); // optimistic
    update.mutate({ [key]: next[key] });
  };

  return (
    <AppScreen>
      <AppHeader title={t('privacy.title', { defaultValue: 'Quyền riêng tư' })} onBack={() => navigation.goBack()} />
      <Text variant="caption" style={{ marginBottom: spacing.lg }}>
        {t('privacy.intro', {
          defaultValue:
            'Tắt một mục để dữ liệu của mục đó không được dùng cho AI. Dữ liệu vẫn được giữ lại nguyên vẹn trên thiết bị và máy chủ — chỉ là không gửi cho mô hình.',
        })}
      </Text>

      {!local ? (
        <Text variant="caption">{t('common.loading', { defaultValue: 'Đang tải…' })}</Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {FLAGS.map((f) => {
            const value = local[f.key];
            return (
              <Card key={f.key}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyEm">{t(f.titleKey, { defaultValue: f.key })}</Text>
                    <Text variant="caption" style={{ marginTop: 2 }}>
                      {t(f.bodyKey, { defaultValue: '' })}
                    </Text>
                  </View>
                  <Toggle value={value} onChange={() => toggle(f.key)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </AppScreen>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <Pressable
      onPress={onChange}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
    >
      <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accent.base },
  trackOff: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
});
