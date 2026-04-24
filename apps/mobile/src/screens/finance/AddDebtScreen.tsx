import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { debtsApi, type DebtType } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { parseMoneyInput } from '../../utils/money';

export function AddDebtScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const [type, setType] = useState<DebtType>('I_OWE');
  const [title, setTitle] = useState('');
  const [personName, setPersonName] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const totalN = parseMoneyInput(total);
    const paidN = parseMoneyInput(paid) ?? 0;
    if (!title.trim() || !totalN || totalN <= 0 || paidN > totalN) {
      Alert.alert(t('debts.invalid.title'), t('debts.invalid.body'));
      return;
    }
    setSaving(true);
    try {
      await debtsApi.create({
        type,
        title: title.trim(),
        personName: personName.trim() || undefined,
        totalAmount: totalN,
        paidAmount: paidN,
        dueDate: dueDate.trim() || undefined,
        note: note.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
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
          {t('debts.createTitle')}
        </Text>
        <View style={{ gap: spacing.md }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('debts.form.type')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip label={t('debts.iOwe')} selected={type === 'I_OWE'} onPress={() => setType('I_OWE')} />
              <Chip
                label={t('debts.owedToMe')}
                selected={type === 'OWED_TO_ME'}
                onPress={() => setType('OWED_TO_ME')}
              />
            </View>
          </View>
          <Input
            label={t('debts.form.title')}
            placeholder={t('debts.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('debts.form.person')}
            placeholder={t('debts.form.personPlaceholder')}
            value={personName}
            onChangeText={setPersonName}
          />
          <Input
            label={t('debts.form.totalAmount')}
            placeholder="0"
            value={total}
            onChangeText={setTotal}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('debts.form.paidAmount')}
            placeholder="0"
            value={paid}
            onChangeText={setPaid}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('debts.form.dueDate')}
            placeholder="YYYY-MM-DD"
            value={dueDate}
            onChangeText={setDueDate}
            autoCapitalize="none"
          />
          <Input
            label={t('debts.form.note')}
            placeholder={t('debts.form.notePlaceholder')}
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
