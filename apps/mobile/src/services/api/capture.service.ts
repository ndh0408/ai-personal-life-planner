import { apiClient } from './client';

export type CaptureKind = 'EXPENSE' | 'INCOME' | 'MEAL' | 'TASK' | 'SLEEP' | 'MOOD' | 'UNKNOWN';
export type ParserSource = 'RULE' | 'OPENAI' | 'HYBRID' | 'MANUAL';

export interface CaptureParseResponse {
  kind: CaptureKind;
  source: ParserSource;
  confidence: number;
  previewText: string;
  fields: Record<string, unknown>;
  hint?: string;
  /** Round 21: signal that the parser is unsure — UI should highlight before save. */
  needsReview?: boolean;
}

export interface CaptureConfirmRequest {
  kind: Exclude<CaptureKind, 'UNKNOWN'>;
  fields: Record<string, unknown>;
  idempotencyKey?: string;
  /** Original user text — server writes a QuickCapture audit row when present. */
  rawText?: string;
  /** Parse provenance forwarded so the server can persist a correction. */
  parseSource?: ParserSource;
  parseConfidence?: number;
  /** What the parser originally returned, before the user edited. */
  originalKind?: CaptureKind;
  originalFields?: Record<string, unknown>;
}

export interface CaptureConfirmResponse {
  kind: Exclude<CaptureKind, 'UNKNOWN'>;
  id: string;
  createdAt: string;
  /** Round 22: handle for the undo button. */
  quickCaptureId?: string;
  undoAvailableUntil?: string;
}

/**
 * Best-effort device timezone — Hermes ships Intl on RN 0.74, but very old
 * Android Hermes builds may not. Default to Asia/Ho_Chi_Minh because that's
 * the app's current audience.
 */
function deviceTz(): string {
  try {
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    return tz || 'Asia/Ho_Chi_Minh';
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}

export interface CaptureUndoResponse {
  quickCaptureId: string;
  reversedEntityType: string;
  reversedEntityId: string;
}

export const captureService = {
  parse(text: string, tz: string = deviceTz()) {
    return apiClient.request<CaptureParseResponse>('POST', '/capture/parse', { text, tz });
  },
  confirm(input: CaptureConfirmRequest) {
    return apiClient.request<CaptureConfirmResponse>('POST', '/capture/confirm', input);
  },
  undo(quickCaptureId: string, reason?: string) {
    return apiClient.request<CaptureUndoResponse>(
      'POST',
      `/capture/${encodeURIComponent(quickCaptureId)}/undo`,
      { reason },
    );
  },
};
