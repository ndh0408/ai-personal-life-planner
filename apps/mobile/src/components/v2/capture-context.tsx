import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CaptureKind } from '@lifeos/taxonomy';

/**
 * Round 41: a tiny global context lets ANY screen open the capture sheet
 * via the floating button or a deep-link without prop-drilling. The actual
 * sheet renders once at the root (CaptureSheetMount) so transitions don't
 * fight with screen nav animations.
 */

interface CaptureCtxValue {
  visible: boolean;
  initialText: string;
  initialKind: CaptureKind | null;
  open: (opts?: { initialText?: string; initialKind?: CaptureKind }) => void;
  close: () => void;
}

const CaptureCtx = createContext<CaptureCtxValue | null>(null);

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [initialText, setInitialText] = useState('');
  const [initialKind, setInitialKind] = useState<CaptureKind | null>(null);

  const open = useCallback<CaptureCtxValue['open']>((opts) => {
    setInitialText(opts?.initialText ?? '');
    setInitialKind(opts?.initialKind ?? null);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  const value = useMemo(
    () => ({ visible, initialText, initialKind, open, close }),
    [visible, initialText, initialKind, open, close],
  );
  return <CaptureCtx.Provider value={value}>{children}</CaptureCtx.Provider>;
}

export function useCapture(): CaptureCtxValue {
  const ctx = useContext(CaptureCtx);
  if (!ctx) throw new Error('useCapture must be inside <CaptureProvider>');
  return ctx;
}
