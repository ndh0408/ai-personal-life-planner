import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Input, Button, Chip } from '../../components/ui';
import { walletsApi, type WalletType } from '../../services/api/finance.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { parseMoneyInput } from '../../utils/money';

const TYPES: WalletType[] = ['CASH', 'BANK', 'EWALLET', 'SAVINGS', 'OTHER'];
const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY'];

export function AddWalletScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const translateError = useErrorMessage();

  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('CASH');
  const [balance, setBalance] = useState('0');
  const [currency, setCurrency] = useState('VND');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(t('wallets.invalidNameTitle'), t('wallets.invalidNameBody'));
      return;
    }
    setSaving(true);
    try {
      await walletsApi.create({
        name: name.trim(),
        type,
        balance: parseMoneyInput(balance) ?? 0,
        currency,
      });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.lg }]}>
          {t('wallets.createTitle')}
        </Text>
        <View style={{ gap: spacing.md }}>
          <Input
            label={t('wallets.form.name')}
            placeholder={t('wallets.form.namePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('wallets.form.type')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {TYPES.map((x) => (
                <Chip
                  key={x}
                  label={t(`wallets.types.${x}`)}
                  selected={type === x}
                  onPress={() => setType(x)}
                />
              ))}
            </View>
          </View>
          <Input
            label={t('wallets.form.balance')}
            placeholder="0"
            value={balance}
            onChangeText={setBalance}
            keyboardType="decimal-pad"
          />
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('wallets.form.currency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>
          </View>
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
