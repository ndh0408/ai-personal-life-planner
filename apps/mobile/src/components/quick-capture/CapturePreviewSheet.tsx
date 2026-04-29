/**
 * Bottom sheet that opens after `/capture/parse` returns. Round 21 turned
 * this from a "title + amount only" lightweight editor into a proper
 * preview-and-edit surface: every kind has its real fields exposed
 * (category, date/time, due date for tasks, etc), INCOME has its own
 * editor, and a needsReview banner appears when the parser is uncertain.
 *
 * Confirm sends the fields back along with the original parse so the
 * server can persist a CaptureCorrection if the user changed anything —
 * that record then becomes a few-shot example on the next parse.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Chip, Text } from '../ui';
import { spacing, colors } from '../../theme';
import { KindBadge } from './KindBadge';
import { CaptureFieldEditor, type FieldsState } from './CaptureFieldEditor';
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

function isInsertableKind(k: CaptureKind): k is Exclude<CaptureKind, 'UNKNOWN'> {
  return k !== 'UNKNOWN';
}

export function CapturePreviewSheet({ visible, parsed, busy = false, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<FieldsState>({});
  const [kind, setKind] = useState<CaptureKind | null>(null);

  // Idempotency key — stable per "open of the sheet for this parse result".
  // Resetting on a *new* parse is correct (different submission); the user
  // editing fields inline must NOT change the key, otherwise a retry after a
  // network blip would create a duplicate row instead of returning the existing.
  const idemKeyRef = useRef<string | undefined>(undefined);

  // Snapshot of the original parse so we can detect edits on save.
  const originalRef = useRef<{ kind: CaptureKind; fields: FieldsState } | null>(null);

  useEffect(() => {
    if (parsed) {
      setFields({ ...parsed.fields });
      setKind(parsed.kind);
      idemKeyRef.current = makeIdempotencyKey();
      originalRef.current = { kind: parsed.kind, fields: { ...parsed.fields } };
    } else {
      idemKeyRef.current = undefined;
      originalRef.current = null;
    }
  }, [parsed]);

  if (!parsed || !kind) return null;

  const submit = () => {
    if (!isInsertableKind(kind)) return;
    const original = originalRef.current;
    onConfirm({
      kind,
      fields,
      idempotencyKey: idemKeyRef.current,
      parseSource: parsed.source,
      parseConfidence: parsed.confidence,
      originalKind: original?.kind,
      originalFields: original?.fields,
    });
  };

  const insertable = isInsertableKind(kind);
  const needsReview = parsed.needsReview ?? false;

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.85}>
      <View style={{ gap: spacing.md }}>
        <KindBadge kind={kind} />
        <Text variant="title">{t('capture.previewTitle')}</Text>

        {/* When the parser was unsure, surface the badge so the user knows to
            double-check before saving. */}
        {needsReview ? (
          <View style={styles.reviewBanner}>
            <Text variant="caption" style={{ color: colors.status.warning, fontWeight: '700' }}>
              {t('capture.needsReview') ?? '⚠️ Cần kiểm tra lại trước khi lưu'}
            </Text>
          </View>
        ) : null}

        <Text variant="caption">{parsed.previewText}</Text>

        <KindSwitcher kind={kind} onChange={setKind} />

        <CaptureFieldEditor kind={kind} fields={fields} setFields={setFields} />

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

// ── Kind switcher ────────────────────────────────────────────────────────────

function KindSwitcher({ kind, onChange }: { kind: CaptureKind; onChange: (k: CaptureKind) => void }) {
  const { t } = useTranslation();
  const options: Exclude<CaptureKind, 'UNKNOWN'>[] = ['EXPENSE', 'INCOME', 'TASK', 'MEAL', 'SLEEP', 'MOOD'];
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" style={styles.fieldLabel}>
        {t('capture.fields.kind') ?? 'Loại'}
      </Text>
      <View style={styles.chipRow}>
        {options.map((k) => (
          <Chip
            key={k}
            label={t(`capture.kinds.${k}`) ?? k}
            tone="accent"
            selected={kind === k}
            onPress={() => onChange(k)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reviewBanner: {
    backgroundColor: colors.status.warning + '22',
    borderColor: colors.status.warning,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
});
