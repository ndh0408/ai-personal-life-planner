/**
 * Bottom sheet that opens after `/capture/parse` returns. Shows the detected
 * kind + parsed fields with light editability (title + amount/cost), then
 * fires `/capture/confirm` to insert.
 *
 * The "advanced" idea per UX_PRINCIPLES: only the 1-2 most important fields
 * are editable in the sheet; deeper editing happens in the per-feature screen
 * later. Parsed fields the user doesn't change are sent back verbatim.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Chip, TextField, Text } from '../ui';
import { spacing } from '../../theme';
import { KindBadge } from './KindBadge';
import { makeIdempotencyKey } from '../../utils/idempotency';
import {
  type CaptureConfirmRequest,
  type CaptureKind,
  type CaptureParseResponse,
} from '../../services/api/capture.service';

interface Props {
  visible: boolean;
  parsed: CaptureParseResponse | null;
  busy?: boolean;
  onConfirm: (req: CaptureConfirmRequest) => void;
  onClose: () => void;
}

type FieldsState = Record<string, unknown>;

function isInsertableKind(k: CaptureKind): k is Exclude<CaptureKind, 'UNKNOWN'> {
  return k !== 'UNKNOWN';
}

export function CapturePreviewSheet({ visible, parsed, busy = false, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<FieldsState>({});

  // Idempotency key — stable per "open of the sheet for this parse result".
  // Resetting on a *new* parse is correct (different submission); the user
  // editing fields inline must NOT change the key, otherwise a retry after a
  // network blip would create a duplicate row instead of returning the existing.
  const idemKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (parsed) {
      setFields({ ...parsed.fields });
      idemKeyRef.current = makeIdempotencyKey();
    } else {
      idemKeyRef.current = undefined;
    }
  }, [parsed]);

  const idempotencyKey = idemKeyRef.current;

  if (!parsed) return null;

  const submit = () => {
    if (!isInsertableKind(parsed.kind)) return;
    onConfirm({ kind: parsed.kind, fields, idempotencyKey });
  };

  const insertable = isInsertableKind(parsed.kind);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.7}>
      <View style={{ gap: spacing.md }}>
        <KindBadge kind={parsed.kind} />
        <Text variant="title">{t('capture.previewTitle')}</Text>
        <Text variant="caption">{parsed.previewText}</Text>

        <View style={{ height: spacing.sm }} />

        <FieldEditor kind={parsed.kind} fields={fields} setFields={setFields} />

        {parsed.hint ? (
          <Text variant="caption" style={{ marginTop: spacing.sm }}>
            {parsed.hint}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            label={t('capture.confirm')}
            onPress={submit}
            loading={busy}
            disabled={!insertable || busy}
          />
          <Button label={t('capture.discard')} variant="ghost" onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}

// ── Field editors per kind ────────────────────────────────────────────────────

interface EditorProps {
  kind: CaptureKind;
  fields: FieldsState;
  setFields: React.Dispatch<React.SetStateAction<FieldsState>>;
}

function FieldEditor({ kind, fields, setFields }: EditorProps) {
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
            label={t(`${translateKey}.${opt}`)}
            tone="accent"
            selected={value === opt}
            onPress={() => onChange(opt)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
