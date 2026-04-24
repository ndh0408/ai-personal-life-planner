import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { savingGoalsApi } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { parseMoneyInput } from '../../utils/money';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export function AddSavingGoalScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const tgt = parseMoneyInput(target);
    const cur = parseMoneyInput(current) ?? 0;
    if (!title.trim() || !tgt || tgt <= 0) {
      Alert.alert(t('savings.invalid.title'), t('savings.invalid.body'));
      return;
    }
    setSaving(true);
    try {
      await savingGoalsApi.create({
        title: title.trim(),
        targetAmount: tgt,
        currentAmount: cur,
        targetDate: targetDate.trim() || undefined,
        priority,
        note: note.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['saving-goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      nav.goBack();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {t('savings.createTitle')}
        </Text>
        <View style={{ gap: spacing.md }}>
          <Input
            label={t('savings.form.title')}
            placeholder={t('savings.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('savings.form.targetAmount')}
            placeholder="0"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('savings.form.currentAmount')}
            placeholder="0"
            value={current}
            onChangeText={setCurrent}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('savings.form.targetDate')}
            placeholder="YYYY-MM-DD"
            value={targetDate}
            onChangeText={setTargetDate}
            autoCapitalize="none"
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('savings.form.priority')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((p) => (
                <Chip
                  key={p}
                  label={t(`tasks.priority.${p}`)}
                  selected={priority === p}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          </View>
          <Input
            label={t('savings.form.note')}
            placeholder={t('savings.form.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>
        <Button
          title={saving ? t('common.loading') : t('common.save')}
          onPress={submit}
          disabled={saving}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}
