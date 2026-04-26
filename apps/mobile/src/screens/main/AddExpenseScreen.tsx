import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import { financeService } from '../../services/api/finance.service';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const CATEGORIES = ['food', 'transport', 'shopping', 'health', 'learning', 'bills', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * Cheap UUID-ish key — enough to dedupe a double-tap on the same form session.
 * The real cryptographic randomness lives server-side; this is just a marker.
 */
function makeKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AddExpenseScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<Category>('food');
  const [note, setNote] = useState('');
  // Stable per-mount idempotency key — survives mutation retries inside this form.
  const idemKey = useRef(makeKey()).current;

  const expenseDateIso = useMemo(() => new Date().toISOString(), []);

  const create = useMutation({
    mutationFn: () =>
      financeService.create({
        title: title.trim(),
        amount,
        category,
        expenseDateIso,
        note: note.trim() || null,
        idempotencyKey: idemKey,
      }),
    onSuccess: () => {
      toast.show(t('money.added'), 'success');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const canSubmit = title.trim().length > 0 && amount > 0 && !create.isPending;

  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.money')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('money.addTitle')}
      </Text>

      <Card style={{ gap: spacing.lg }}>
        <TextField
          label={t('money.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('money.placeholders.title')}
          autoFocus
        />
        <MoneyInput label={t('money.fields.amount')} value={amount} onChange={setAmount} />

        <View>
          <Text variant="kicker" style={{ marginBottom: spacing.xs }}>
            {t('money.fields.category')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={t(`money.categories.${c}`)}
                tone="accent"
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </View>

        <TextField
          label={t('money.fields.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('money.placeholders.note')}
        />
      </Card>

      <View style={{ height: spacing.xl }} />

      <Button
        label={create.isPending ? t('common.loading') : t('money.saveCta')}
        onPress={() => create.mutate()}
        disabled={!canSubmit}
        loading={create.isPending}
      />
      <View style={{ height: spacing.sm }} />
      <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
    </AppScreen>
  );
}
