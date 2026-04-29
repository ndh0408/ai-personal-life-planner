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
import { colors, spacing } from '../../theme';
import {
  captureService,
  type CaptureKind,
  type CaptureParseResponse,
} from '../../services/api/capture.service';
import { formatMoney } from '../../utils/format';
import { makeIdempotencyKey } from '../../utils/idempotency';
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

export function SmartEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [preview, setPreview] = useState<CaptureParseResponse | null>(null);
  const idemKey = useRef(makeIdempotencyKey()).current;

  // Per-call request id — guards against out-of-order parse responses when
  // the user types fast: in-flight request 3 may resolve after request 4,
  // and we must not overwrite the newer preview with the older one.
  const reqIdRef = useRef(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(text.trim()), 400);
    return () => clearTimeout(handle);
  }, [text]);

  // Plain async fetch — no useMutation here because mutations don't expose
  // a cancel signal and we need request-ordering control. The reqId guard
  // makes stale responses no-ops.
  const [parsing, setParsing] = useState(false);
  useEffect(() => {
    if (debounced.length < 3) {
      setPreview(null);
      setParsing(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setParsing(true);
    captureService
      .parse(debounced)
      .then((res) => {
        if (myId !== reqIdRef.current) return;
        setPreview(res);
        setParsing(false);
      })
      .catch(() => {
        if (myId !== reqIdRef.current) return;
        setPreview(null);
        setParsing(false);
      });
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

      {parsing && debounced.length >= 3 ? (
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
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en' : 'vi';
  // Hooks must run unconditionally — keep useMemo above the UNKNOWN early-return
  // so render order is stable across kind changes (Rules of Hooks).
  const summary = useMemo(
    () => summarize(preview, rawText, locale),
    [preview, rawText, locale],
  );

  if (preview.kind === 'UNKNOWN') {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Icon name={KIND_ICON.UNKNOWN} size={18} color={KIND_TONE.UNKNOWN} />
          <Text variant="bodyEm">{t('smart.unknownTitle')}</Text>
        </View>
        <Text variant="caption">
          {preview.hint ?? t('smart.unknownBody')}
        </Text>
      </Card>
    );
  }

  const tone = KIND_TONE[preview.kind];
  const sourceLabel =
    preview.source === 'OPENAI' ? t('smart.sourceAi') : t('smart.sourceRule');

  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: tone, paddingLeft: spacing.md }}>
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
          <Icon name={KIND_ICON[preview.kind]} size={18} color={tone} />
        </View>
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
      {summary.lines
        .filter((l) => l.trim().length > 0)
        .map((line, i) => (
          <Text key={`${i}-${line}`} variant="caption" style={{ marginTop: 2 }}>
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

function summarize(
  p: CaptureParseResponse,
  raw: string,
  locale: 'vi' | 'en' = 'vi',
): PreviewSummary {
  const f = p.fields as Record<string, unknown>;
  switch (p.kind) {
    case 'EXPENSE': {
      const amount = Number(f.amount ?? 0);
      const cat = String(f.category ?? 'other');
      return {
        title: String(f.title ?? raw),
        lines: [
          `${formatMoney(amount)}  ·  ${cat}`,
          formatLocal(f.expenseDateIso, locale),
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
          formatLocal(f.incomeDateIso, locale),
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
      if (f.dueAtIso) lines.push(formatLocal(f.dueAtIso, locale));
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

function formatLocal(iso: unknown, locale: string = 'vi-VN'): string {
  if (typeof iso !== 'string') return '';
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}
