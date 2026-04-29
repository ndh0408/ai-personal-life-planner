/**
 * SmartEntryScreen — the universal "Add anything" surface.
 *
 * One text input. The user types in natural Vietnamese (or English). After a
 * 400ms debounce we POST /capture/parse and the server tells us:
 *   - kind: EXPENSE | INCOME | MEAL | TASK | SLEEP | MOOD | UNKNOWN
 *   - source: RULE (regex) or OPENAI (the user's own key)
 *   - fields with smart defaults already filled in
 *
 * The user sees an AI preview card. Tap "Lưu" → POST /capture/confirm, the
 * server inserts into the matching table and (for EXPENSE/INCOME) wraps the
 * write in a $transaction with the wallet update. No category chips, no
 * income/expense toggle — the AI decides.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { spacing } from '../../theme';
import {
  captureService,
  type CaptureKind,
  type CaptureParseResponse,
} from '../../services/api/capture.service';
import { formatMoney } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartEntry'>;

const KIND_GLYPH: Record<CaptureKind, string> = {
  EXPENSE: '💸',
  INCOME: '💰',
  MEAL: '🍚',
  TASK: '✓',
  SLEEP: '💤',
  MOOD: '🎯',
  UNKNOWN: '?',
};

const KIND_TONE: Record<CaptureKind, string> = {
  EXPENSE: '#C24A3F',
  INCOME: '#2E8B57',
  MEAL: '#C97B4A',
  TASK: '#3F6FB1',
  SLEEP: '#5D4FA8',
  MOOD: '#B47A30',
  UNKNOWN: '#7A7A7A',
};

function makeKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function SmartEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [preview, setPreview] = useState<CaptureParseResponse | null>(null);
  const idemKey = useRef(makeKey()).current;

  // Debounce text input → parse call.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(text.trim()), 400);
    return () => clearTimeout(handle);
  }, [text]);

  const parseMut = useMutation({
    mutationFn: (input: string) => captureService.parse(input),
    onSuccess: (res) => setPreview(res),
    onError: () => setPreview(null),
  });

  // Fire parse when debounced text settles + has substance.
  useEffect(() => {
    if (debounced.length < 3) {
      setPreview(null);
      return;
    }
    parseMut.mutate(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!preview || preview.kind === 'UNKNOWN') {
        throw new Error('Chưa có gì để lưu');
      }
      return captureService.confirm({
        kind: preview.kind,
        fields: preview.fields,
        rawText: text.trim(),
        idempotencyKey: idemKey,
      });
    },
    onSuccess: (res) => {
      toast.show(t(`smart.savedKinds.${res.kind}`), 'success');
      // Invalidate every read-side query — cheap and avoids per-kind branching.
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['incomes'] });
      qc.invalidateQueries({ queryKey: ['finance'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      qc.invalidateQueries({ queryKey: ['sleep'] });
      qc.invalidateQueries({ queryKey: ['mood'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      navigation.goBack();
    },
    onError: (e) => toast.show((e as Error).message, 'danger'),
  });

  const canSave =
    !!preview && preview.kind !== 'UNKNOWN' && !confirmMut.isPending;

  return (
    <AppScreen>
      <Text variant="kicker">{t('smart.kicker')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        {t('smart.title')}
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

      {parseMut.isPending && debounced.length >= 3 ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="caption">{t('smart.thinking')}</Text>
        </Card>
      ) : null}

      {preview ? <PreviewCard preview={preview} rawText={text} /> : null}

      <View style={{ height: spacing.lg }} />

      <Button
        label={confirmMut.isPending ? t('common.loading') : t('smart.saveCta')}
        onPress={() => confirmMut.mutate()}
        disabled={!canSave}
        loading={confirmMut.isPending}
      />
      <View style={{ height: spacing.sm }} />
      <Button
        label={t('common.cancel')}
        variant="ghost"
        onPress={() => navigation.goBack()}
      />
    </AppScreen>
  );
}

function PreviewCard({
  preview,
  rawText,
}: {
  preview: CaptureParseResponse;
  rawText: string;
}) {
  const { t } = useTranslation();

  if (preview.kind === 'UNKNOWN') {
    return (
      <Card>
        <Text variant="bodyEm" style={{ marginBottom: spacing.xs }}>
          {KIND_GLYPH.UNKNOWN} {t('smart.unknownTitle')}
        </Text>
        <Text variant="caption">
          {preview.hint ?? t('smart.unknownBody')}
        </Text>
      </Card>
    );
  }

  const tone = KIND_TONE[preview.kind];
  const summary = useMemo(() => summarize(preview, rawText), [preview, rawText]);
  const sourceLabel =
    preview.source === 'OPENAI' ? t('smart.sourceAi') : t('smart.sourceRule');

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: tone, paddingLeft: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text variant="bodyEm" style={{ fontSize: 18 }}>
          {KIND_GLYPH[preview.kind]}
        </Text>
        <Text variant="bodyEm" style={{ color: tone }}>
          {t(`smart.kindLabels.${preview.kind}`)}
        </Text>
        <Text variant="caption" style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {sourceLabel} · {Math.round(preview.confidence * 100)}%
        </Text>
      </View>
      <Text variant="bodyEm" style={{ marginTop: spacing.sm }}>
        {summary.title}
      </Text>
      {summary.lines.map((line) => (
        <Text key={line} variant="caption" style={{ marginTop: 2 }}>
          {line}
        </Text>
      ))}
    </Card>
  );
}

interface PreviewSummary {
  title: string;
  lines: string[];
}

function summarize(p: CaptureParseResponse, raw: string): PreviewSummary {
  const f = p.fields as Record<string, unknown>;
  switch (p.kind) {
    case 'EXPENSE': {
      const amount = Number(f.amount ?? 0);
      const cat = String(f.category ?? 'other');
      return {
        title: String(f.title ?? raw),
        lines: [
          `${formatMoney(amount)}  ·  ${cat}`,
          formatLocal(f.expenseDateIso),
        ],
      };
    }
    case 'INCOME': {
      const amount = Number(f.amount ?? 0);
      const cat = String(f.category ?? 'other');
      return {
        title: String(f.title ?? raw),
        lines: [
          `+${formatMoney(amount)}  ·  ${cat}`,
          formatLocal(f.incomeDateIso),
        ],
      };
    }
    case 'MEAL': {
      const cost = f.cost != null ? formatMoney(Number(f.cost)) : null;
      return {
        title: String(f.title ?? raw),
        lines: [String(f.mealType ?? 'LUNCH'), cost ?? ''].filter(Boolean),
      };
    }
    case 'TASK': {
      const lines: string[] = [String(f.priority ?? 'MEDIUM')];
      if (f.dueAtIso) lines.push(formatLocal(f.dueAtIso));
      return { title: String(f.title ?? raw), lines };
    }
    case 'SLEEP': {
      const min = Number(f.durationMinutes ?? 0);
      const hours = (min / 60).toFixed(1);
      const lines = [`${hours}h`];
      if (f.quality) lines.push(String(f.quality));
      return { title: 'Giấc ngủ', lines };
    }
    case 'MOOD': {
      return {
        title: `${f.mood ?? '—'}`,
        lines: [String(f.energy ?? 'MEDIUM')],
      };
    }
    default:
      return { title: raw, lines: [] };
  }
}

function formatLocal(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}
