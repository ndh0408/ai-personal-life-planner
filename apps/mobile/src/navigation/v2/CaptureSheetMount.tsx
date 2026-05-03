import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaptureSheetV2, useCapture } from '../../components/v2';
import type { CaptureKind } from '@lifeos/taxonomy';
import { classifyCapture } from '../../intelligence/capture-classifier';

/**
 * Single capture sheet mount at the root. The on-device classifier runs in
 * a 250ms debounce on the live text — fast enough to feel instant, slow
 * enough to skip every keystroke. The result feeds CaptureSheetV2's
 * `suggestedKind` prop.
 *
 * Submission for Round 41: optimistic UX (close immediately, log to console).
 * Wiring to /api/capture/parse + /api/capture/confirm lands in the same PR
 * once the existing capture services are aligned with the v2 prompt registry.
 */
export function CaptureSheetMount() {
  const capture = useCapture();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';

  const [text, setText] = useState('');
  const [suggestedKind, setSuggestedKind] = useState<CaptureKind | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open so each session starts clean. Initial overrides come
  // through the context (a quick-action chip preselects MEAL etc).
  useEffect(() => {
    if (!capture.visible) return;
    setText(capture.initialText);
    setSuggestedKind(capture.initialKind);
  }, [capture.visible, capture.initialText, capture.initialKind]);

  // Debounce-classify. 250ms is the sweet spot: human eye perceives
  // "instant" up to ~150ms, but we want to skip mid-word typing.
  useEffect(() => {
    if (!capture.visible || text.length === 0) {
      if (capture.initialKind) return; // initial-kind overrides
      setSuggestedKind(null);
      return;
    }
    const handle = setTimeout(() => {
      const r = classifyCapture(text);
      if (r.confidence >= 0.5) setSuggestedKind(r.kind);
    }, 250);
    return () => clearTimeout(handle);
  }, [text, capture.visible, capture.initialKind]);

  return (
    <CaptureSheetV2
      visible={capture.visible}
      onClose={capture.close}
      initialText={capture.initialText}
      suggestedKind={suggestedKind}
      submitting={submitting}
      locale={locale}
      onSubmit={async (s) => {
        setSubmitting(true);
        try {
          // Round 41: optimistic close. The existing capture service still
          // owns server-side parsing; we'll wire the classified kind through
          // a new endpoint once the prompt registry adapter ships.
          await new Promise<void>((resolve) => setTimeout(() => resolve(), 200));
          capture.close();
        } finally {
          setSubmitting(false);
        }
      }}
    />
  );
}
