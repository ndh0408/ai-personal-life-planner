/**
 * Per-kind field editor used by both CapturePreviewSheet (Home flow) and
 * SmartEntryScreen (full-screen flow). Extracted in round 21 so both
 * surfaces can offer the same inline editing rather than the previous
 * "title-only" preview that the SmartEntry screen had.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip, TextField, Text } from '../ui';
import { spacing, colors } from '../../theme';
import type { CaptureKind } from '../../services/api/capture.service';

export type FieldsState = Record<string, unknown>;

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'bills',
  'shopping',
  'health',
  'learning',
  'entertainment',
  'family',
  'other',
] as const;

export const INCOME_CATEGORIES = [
  'salary',
  'bonus',
  'freelance',
  'gift',
  'refund',
  'investment',
  'other',
] as const;

export interface CaptureFieldEditorProps {
  kind: CaptureKind;
  fields: FieldsState;
  setFields: React.Dispatch<React.SetStateAction<FieldsState>>;
}

export function CaptureFieldEditor({ kind, fields, setFields }: CaptureFieldEditorProps) {
  const { t } = useTranslation();
  const set = (k: string, v: unknown) => setFields((s) => ({ ...s, [k]: v }));

  switch (kind) {
    case 'EXPENSE':
      return (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={t('capture.fields.title')}
            value={String(fields.title ?? '')}
            onChangeText={(v) => set('title', v)}
          />
          <TextField
            label={t('capture.fields.amount')}
            value={String(fields.amount ?? 0)}
            onChangeText={(v) => set('amount', parseInt(v.replace(/\D/g, ''), 10) || 0)}
            keyboardType="numeric"
          />
          <ChipRow
            label={t('capture.fields.category', { defaultValue: 'Danh mục' })}
            options={EXPENSE_CATEGORIES}
            value={String(fields.category ?? 'other')}
            onChange={(v) => set('category', v)}
            translateKey="capture.expenseCategories"
          />
          <DateTimeField
            label={t('capture.fields.date', { defaultValue: 'Ngày giờ' })}
            isoValue={String(fields.expenseDateIso ?? new Date().toISOString())}
            onChange={(iso) => set('expenseDateIso', iso)}
          />
        </View>
      );
    case 'INCOME':
      return (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={t('capture.fields.title')}
            value={String(fields.title ?? '')}
            onChangeText={(v) => set('title', v)}
          />
          <TextField
            label={t('capture.fields.amount')}
            value={String(fields.amount ?? 0)}
            onChangeText={(v) => set('amount', parseInt(v.replace(/\D/g, ''), 10) || 0)}
            keyboardType="numeric"
          />
          <ChipRow
            label={t('capture.fields.category', { defaultValue: 'Nguồn' })}
            options={INCOME_CATEGORIES}
            value={String(fields.category ?? 'other')}
            onChange={(v) => set('category', v)}
            translateKey="capture.incomeCategories"
          />
          <DateTimeField
            label={t('capture.fields.date', { defaultValue: 'Ngày giờ' })}
            isoValue={String(fields.incomeDateIso ?? new Date().toISOString())}
            onChange={(iso) => set('incomeDateIso', iso)}
          />
        </View>
      );
    case 'MEAL':
      return (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={t('capture.fields.title')}
            value={String(fields.title ?? '')}
            onChangeText={(v) => set('title', v)}
          />
          <ChipRow
            label={t('capture.fields.mealType')}
            options={['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const}
            value={String(fields.mealType ?? 'LUNCH')}
            onChange={(v) => set('mealType', v)}
            translateKey="capture.mealTypes"
          />
          <TextField
            label={t('capture.fields.cost', { defaultValue: 'Số tiền (tuỳ chọn)' })}
            value={fields.cost == null ? '' : String(fields.cost)}
            onChangeText={(v) =>
              set('cost', v.trim().length === 0 ? null : parseInt(v.replace(/\D/g, ''), 10) || 0)
            }
            keyboardType="numeric"
          />
          <DateTimeField
            label={t('capture.fields.date', { defaultValue: 'Ngày giờ' })}
            isoValue={String(fields.loggedAtIso ?? new Date().toISOString())}
            onChange={(iso) => set('loggedAtIso', iso)}
          />
        </View>
      );
    case 'TASK':
      return (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={t('capture.fields.title')}
            value={String(fields.title ?? '')}
            onChangeText={(v) => set('title', v)}
          />
          <ChipRow
            label={t('capture.fields.priority')}
            options={['LOW', 'MEDIUM', 'HIGH'] as const}
            value={String(fields.priority ?? 'MEDIUM')}
            onChange={(v) => set('priority', v)}
            translateKey="capture.priorities"
          />
          <DateTimeField
            label={t('capture.fields.dueAt', { defaultValue: 'Hạn' })}
            isoValue={fields.dueAtIso ? String(fields.dueAtIso) : null}
            onChange={(iso) => set('dueAtIso', iso)}
            allowClear
          />
        </View>
      );
    case 'SLEEP': {
      const minutes = Number(fields.durationMinutes ?? 0);
      const hours = (minutes / 60).toFixed(1);
      return (
        <View style={{ gap: spacing.md }}>
          <TextField label={t('capture.fields.durationHours')} value={hours} editable={false} />
          <ChipRow
            label={t('capture.fields.quality')}
            options={['BAD', 'OK', 'GOOD'] as const}
            value={String(fields.quality ?? 'OK')}
            onChange={(v) => set('quality', v)}
            translateKey="capture.qualities"
          />
        </View>
      );
    }
    case 'MOOD':
      return (
        <View style={{ gap: spacing.md }}>
          <ChipRow
            label={t('capture.fields.mood')}
            options={['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD'] as const}
            value={String(fields.mood ?? 'OK')}
            onChange={(v) => set('mood', v)}
            translateKey="capture.moods"
          />
          <ChipRow
            label={t('capture.fields.energy')}
            options={['LOW', 'MEDIUM', 'HIGH'] as const}
            value={String(fields.energy ?? 'MEDIUM')}
            onChange={(v) => set('energy', v)}
            translateKey="capture.energies"
          />
        </View>
      );
    default:
      return null;
  }
}

interface ChipRowProps<T extends string> {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (v: T) => void;
  translateKey: string;
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  translateKey,
}: ChipRowProps<T>) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <Chip
            key={opt}
            label={t(`${translateKey}.${opt}`, { defaultValue: opt })}
            tone="accent"
            selected={value === opt}
            onPress={() => onChange(opt)}
          />
        ))}
      </View>
    </View>
  );
}

function DateTimeField({
  label,
  isoValue,
  onChange,
  allowClear,
}: {
  label: string;
  isoValue: string | null;
  onChange: (iso: string | null) => void;
  allowClear?: boolean;
}) {
  const display = useMemo(() => {
    if (!isoValue) return '—';
    try {
      const d = new Date(isoValue);
      return d.toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      });
    } catch {
      return isoValue;
    }
  }, [isoValue]);

  const setOffsetMs = (offsetMs: number) => {
    onChange(new Date(Date.now() + offsetMs).toISOString());
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" style={styles.fieldLabel}>
        {label}
      </Text>
      <Text variant="bodyEm">{display}</Text>
      <View style={styles.chipRow}>
        <Chip label="Bây giờ" tone="accent" onPress={() => setOffsetMs(0)} />
        <Chip label="−1h" tone="accent" onPress={() => setOffsetMs(-60 * 60_000)} />
        <Chip label="Hôm qua" tone="accent" onPress={() => setOffsetMs(-24 * 60 * 60_000)} />
        <Chip label="+1h" tone="accent" onPress={() => setOffsetMs(60 * 60_000)} />
        {allowClear ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
            <Text variant="caption" style={{ color: colors.text.muted, padding: 6 }}>
              ✕ Xoá
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
