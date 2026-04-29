/**
 * SmartEntryScreen — the universal "Add anything" surface.
 *
 * Round 21 turned this from a read-only preview into a full inline editor:
 * the user types, the parser proposes, and the user can adjust kind,
 * category, date/time, amount, etc. before saving. Edits ride along on
 * confirm so the server can persist a CaptureCorrection that improves
 * future parses.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Chip,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
  captureService,
  type CaptureKind,
  type CaptureParseResponse,
} from '../../services/api/capture.service';
import { CaptureFieldEditor } from '../../components/quick-capture/CaptureFieldEditor';
import { makeIdempotencyKey } from '../../utils/idempotency';
import { useDebugStore } from '../../store/debug.store';
import type { IconName } from '../../components/ui';
import { Icon } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartEntry'>;

const KIND_ICON: Record<CaptureKind, IconName> = {
  EXPENSE: 'cash-outline',
  INCOME: 'trending-up-outline',
  MEAL: 'restaurant-outline',
  TASK: 'checkmark-circle-outline',
  SLEEP: 'moon-outline',
  MOOD: 'happy-outline',
  UNKNOWN: 'flash-outline',
};

const KIND_TONE: Record<CaptureKind, string> = {
  EXPENSE: colors.expense.base,
  INCOME: colors.income.base,
  MEAL: colors.status.success,
  TASK: colors.status.info,
  SLEEP: '#9085C7',
  MOOD: colors.status.warning,
  UNKNOWN: colors.text.muted,
};

const SWITCHABLE_KINDS: Exclude<CaptureKind, 'UNKNOWN'>[] = [
  'EXPENSE',
  'INCOME',
  'TASK',
  'MEAL',
  'SLEEP',
  'MOOD',
];

export function SmartEntryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const mode = route.params?.mode ?? 'auto';

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [preview, setPreview] = useState<CaptureParseResponse | null>(null);
  // Editable working copy — diverges from preview as the user adjusts.
  const [editableKind, setEditableKind] = useState<CaptureKind | null>(null);
  const [editableFields, setEditableFields] = useState<Record<string, unknown>>({});
  const idemKey = useRef(makeIdempotencyKey()).current;
  // Snapshot of what the parser originally returned. Sent on confirm so the
  // server can persist a CaptureCorrection if the user changed anything.
  const originalRef = useRef<{ kind: CaptureKind; fields: Record<string, unknown> } | null>(null);

  // Per-call request id — guards against out-of-order parse responses when
  // the user types fast: in-flight request 3 may resolve after request 4.
  const reqIdRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(text.trim()), 400);
    return () => clearTimeout(handle);
  }, [text]);

  const [parsing, setParsing] = useState(false);
  useEffect(() => {
    if (debounced.length < 3) {
      setPreview(null);
      setEditableKind(null);
      setEditableFields({});
      setParsing(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setParsing(true);
    captureService
      .parse(debounced)
      .then((res) => {
        if (myId !== reqIdRef.current) return;
        // Quick-action mode forces a kind: when the user tapped "Chi tiêu",
        // treat the result as EXPENSE even if the parser said UNKNOWN. Keeps
        // mode-launches feeling intentional.
        const finalRes =
          mode !== 'auto' && res.kind === 'UNKNOWN'
            ? { ...res, kind: mode as CaptureKind, needsReview: true }
            : res;
        setPreview(finalRes);
        setEditableKind(finalRes.kind);
        setEditableFields({ ...finalRes.fields });
        originalRef.current = { kind: finalRes.kind, fields: { ...finalRes.fields } };
        // Surface in DevPanel so a confused user can see what the parser saw.
        useDebugStore.getState().recordParse({
          rawText: debounced,
          kind: finalRes.kind,
          source: finalRes.source,
          confidence: finalRes.confidence,
          needsReview: !!finalRes.needsReview,
          at: Date.now(),
        });
        setParsing(false);
      })
      .catch(() => {
        if (myId !== reqIdRef.current) return;
        setPreview(null);
        setEditableKind(null);
        setEditableFields({});
        originalRef.current = null;
        setParsing(false);
      });
  }, [debounced, mode]);

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!preview || !editableKind || editableKind === 'UNKNOWN') {
        throw new Error('Chưa có gì để lưu');
      }
      const original = originalRef.current;
      return captureService.confirm({
        kind: editableKind,
        fields: editableFields,
        rawText: text.trim(),
        idempotencyKey: idemKey,
        parseSource: preview.source,
        parseConfidence: preview.confidence,
        originalKind: original?.kind,
        originalFields: original?.fields,
      });
    },
    onSuccess: (res) => {
      const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['expenses'] });
        qc.invalidateQueries({ queryKey: ['incomes'] });
        qc.invalidateQueries({ queryKey: ['finance'] });
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['meals'] });
        qc.invalidateQueries({ queryKey: ['sleep'] });
        qc.invalidateQueries({ queryKey: ['mood'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
      };
      invalidate();
      // Snackbar with an undo button — the server gives us a 60 s window.
      // The action runs the reverse and re-invalidates the same query keys.
      if (res.quickCaptureId) {
        toast.showWithAction(t(`smart.savedKinds.${res.kind}`), {
          tone: 'success',
          action: {
            label: t('common.undo', { defaultValue: 'Hoàn tác' }),
            onPress: () => {
              captureService
                .undo(res.quickCaptureId!)
                .then(() => {
                  invalidate();
                  toast.show(t('capture.undone', { defaultValue: 'Đã hoàn tác' }), 'info');
                })
                .catch(() => toast.show(t('capture.errors.undoFailed', { defaultValue: 'Hoàn tác thất bại' }), 'danger'));
            },
          },
        });
      } else {
        toast.show(t(`smart.savedKinds.${res.kind}`), 'success');
      }
      navigation.goBack();
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const canSave =
    !!preview && !!editableKind && editableKind !== 'UNKNOWN' && !confirmMut.isPending;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Text variant="kicker">{t('smart.kicker')}</Text>
        <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
          {mode === 'auto' ? t('smart.title') : t(`smart.modeTitle.${mode}`, { defaultValue: t('smart.title') })}
        </Text>

        <Card style={{ marginBottom: spacing.lg }}>
          <TextField
            label={t('smart.inputLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('smart.placeholder')}
            autoFocus
            multiline
            numberOfLines={3}
          />
          <Text variant="caption" style={{ marginTop: spacing.xs, opacity: 0.7 }}>
            {t('smart.hint')}
          </Text>
        </Card>

        {parsing && debounced.length >= 3 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text variant="caption">{t('smart.thinking')}</Text>
          </Card>
        ) : null}

        {preview && editableKind ? (
          <PreviewEditor
            preview={preview}
            editableKind={editableKind}
            editableFields={editableFields}
            onKindChange={setEditableKind}
            onFieldsChange={setEditableFields}
            t={t}
          />
        ) : null}

        <View style={{ height: spacing.lg }} />

        <Button
          label={confirmMut.isPending ? t('common.loading') : t('smart.saveCta')}
          onPress={() => confirmMut.mutate()}
          disabled={!canSave}
          loading={confirmMut.isPending}
        />
        <View style={{ height: spacing.sm }} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </AppScreen>
  );
}

function PreviewEditor({
  preview,
  editableKind,
  editableFields,
  onKindChange,
  onFieldsChange,
  t,
}: {
  preview: CaptureParseResponse;
  editableKind: CaptureKind;
  editableFields: Record<string, unknown>;
  onKindChange: (k: CaptureKind) => void;
  onFieldsChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const tone = KIND_TONE[editableKind];
  const sourceLabel =
    preview.source === 'OPENAI' || preview.source === 'HYBRID'
      ? t('smart.sourceAi')
      : t('smart.sourceRule');

  if (editableKind === 'UNKNOWN') {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Icon name={KIND_ICON.UNKNOWN} size={18} color={KIND_TONE.UNKNOWN} />
          <Text variant="bodyEm">{t('smart.unknownTitle')}</Text>
        </View>
        <Text variant="caption" style={{ marginBottom: spacing.sm }}>
          {preview.hint ?? t('smart.unknownBody')}
        </Text>
        {/* Kind picker so the user can rescue an UNKNOWN by saying "this is a task". */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SWITCHABLE_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(`smart.kindLabels.${k}`, { defaultValue: k })}
              tone="accent"
              onPress={() => onKindChange(k)}
            />
          ))}
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: tone, paddingLeft: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: tone + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={KIND_ICON[editableKind]} size={18} color={tone} />
        </View>
        <Text variant="bodyEm" style={{ color: tone }}>
          {t(`smart.kindLabels.${editableKind}`, { defaultValue: editableKind })}
        </Text>
        <Text variant="caption" style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {sourceLabel} · {Math.round(preview.confidence * 100)}%
        </Text>
      </View>

      {preview.needsReview ? (
        <View
          style={{
            backgroundColor: colors.status.warning + '22',
            borderColor: colors.status.warning,
            borderWidth: 1,
            borderRadius: 10,
            padding: spacing.sm,
          }}
        >
          <Text variant="caption" style={{ color: colors.status.warning, fontWeight: '700' }}>
            {t('capture.needsReview', { defaultValue: '⚠️ Cần kiểm tra lại trước khi lưu' })}
          </Text>
        </View>
      ) : null}

      {/* Kind switcher — the user can say "no, this is income, not expense". */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {t('capture.fields.kind', { defaultValue: 'Loại' })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SWITCHABLE_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(`capture.kinds.${k}`, { defaultValue: k })}
              tone="accent"
              selected={editableKind === k}
              onPress={() => onKindChange(k)}
            />
          ))}
        </View>
      </View>

      <CaptureFieldEditor kind={editableKind} fields={editableFields} setFields={onFieldsChange} />
    </Card>
  );
}
