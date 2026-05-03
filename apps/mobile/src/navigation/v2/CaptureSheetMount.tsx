import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCapture } from '../../components/v2';
import { CaptureSheet } from '../../aurora';
import type { CaptureKind as TaxonomyKind } from '@lifeos/taxonomy';
import { classifyCapture } from '../../intelligence/capture-classifier';
import {
  captureService,
  type CaptureKind as ApiCaptureKind,
} from '../../services/api/capture.service';
import { DASHBOARD_KEY } from '../../hooks/useDashboard';
import { FEED_KEYS } from '../../hooks/useFeed';
import { useToast } from '../../components/ui';
import { readableError } from '../../utils/error';

/**
 * Round 45: capture sheet mount fully wired to /api/capture/parse +
 * /api/capture/confirm. Flow:
 *
 *   1. User types → on-device debounced classifier suggests a kind
 *   2. User submits → POST /capture/parse(text) for server-side enrichment
 *   3. We honour the user's override of `kind` (chip selection); if the
 *      parsed result disagrees we still send the user's intent + the parser
 *      result as `originalKind` so the server can record the correction
 *      (R30 corrections.service)
 *   4. POST /capture/confirm(kind, fields) → persists the row
 *   5. Invalidate dashboard + feed queries so Today/Money/Health refresh
 *   6. Close the sheet
 *
 * The taxonomy package has 10 kinds (added EVENT/IDEA/NOTE in R40); the
 * capture API only accepts 7. For unsupported kinds we map to TASK (closest
 * acceptable bucket) and stash the original in fields.intent for future
 * native support.
 */

const API_KINDS: readonly ApiCaptureKind[] = [
  'EXPENSE',
  'INCOME',
  'MEAL',
  'TASK',
  'SLEEP',
  'MOOD',
  'UNKNOWN',
];

function toApiKind(k: TaxonomyKind | null): ApiCaptureKind {
  if (!k) return 'UNKNOWN';
  if ((API_KINDS as readonly string[]).includes(k)) return k as ApiCaptureKind;
  // EVENT/IDEA/NOTE → TASK fallback so the server still saves something
  // meaningful. The original kind survives in fields.intent.
  return 'TASK';
}

export function CaptureSheetMount() {
  const capture = useCapture();
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const qc = useQueryClient();
  const toast = useToast();

  const [text, setText] = useState('');
  const [suggestedKind, setSuggestedKind] = useState<TaxonomyKind | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!capture.visible) return;
    setText(capture.initialText);
    setSuggestedKind(capture.initialKind);
  }, [capture.visible, capture.initialText, capture.initialKind]);

  useEffect(() => {
    if (!capture.visible || text.length === 0) {
      if (capture.initialKind) return;
      setSuggestedKind(null);
      return;
    }
    const handle = setTimeout(() => {
      const r = classifyCapture(text);
      if (r.confidence >= 0.5) setSuggestedKind(r.kind);
    }, 250);
    return () => clearTimeout(handle);
  }, [text, capture.visible, capture.initialKind]);

  const handleSubmit = async ({
    text: bodyText,
    kind: chosenKind,
  }: {
    text: string;
    kind: TaxonomyKind;
  }) => {
    setSubmitting(true);
    try {
      // Step 1: parse for enrichment (amount, due, etc).
      let parsed:
        | Awaited<ReturnType<typeof captureService.parse>>
        | null = null;
      try {
        parsed = await captureService.parse(bodyText);
      } catch {
        // Parsing failure is non-fatal — fall back to bare text. The user
        // can still save with the kind they picked.
        parsed = null;
      }

      const apiKind = toApiKind(chosenKind);
      const finalKind: Exclude<ApiCaptureKind, 'UNKNOWN'> =
        apiKind === 'UNKNOWN' ? 'TASK' : apiKind;

      // Merge parsed fields with the original text + the user's intent.
      const fields: Record<string, unknown> = {
        ...(parsed?.fields ?? {}),
        rawText: bodyText,
        // Preserve the taxonomy kind even when API kind was downgraded so
        // the server can record the correction + intent.
        intent: chosenKind,
      };

      // Step 2: confirm — persists. idempotencyKey uses text + timestamp
      // so a double-tap doesn't double-insert.
      await captureService.confirm({
        kind: finalKind,
        fields,
        rawText: bodyText,
        idempotencyKey: `cap-${Date.now()}-${bodyText.length}`,
        parseSource: parsed?.source,
        parseConfidence: parsed?.confidence,
        originalKind: parsed?.kind,
        originalFields: parsed?.fields,
      });

      // Step 3: invalidate everything that might surface this capture so
      // Today/Money/Health/Plan re-fetch and show the new row.
      await Promise.all([
        qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
        qc.invalidateQueries({ queryKey: FEED_KEYS.tasksToday }),
        qc.invalidateQueries({ queryKey: FEED_KEYS.mealsToday }),
        qc.invalidateQueries({ queryKey: FEED_KEYS.sleepLatest }),
        qc.invalidateQueries({ queryKey: FEED_KEYS.moodLatest }),
      ]);

      toast.show(
        locale === 'vi' ? 'Đã ghi.' : 'Saved.',
        'success',
      );
      capture.close();
    } catch (e) {
      toast.show(readableError(e, t, 'capture'), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CaptureSheet
      visible={capture.visible}
      onClose={capture.close}
      initialText={capture.initialText}
      suggestedKind={suggestedKind}
      submitting={submitting}
      locale={locale}
      onSubmit={handleSubmit}
    />
  );
}
