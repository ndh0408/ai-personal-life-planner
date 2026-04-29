import { apiClient } from './client';

export type CaptureKind = 'EXPENSE' | 'INCOME' | 'MEAL' | 'TASK' | 'SLEEP' | 'MOOD' | 'UNKNOWN';
export type ParserSource = 'RULE' | 'OPENAI';

export interface CaptureParseResponse {
  kind: CaptureKind;
  source: ParserSource;
  confidence: number;
  previewText: string;
  fields: Record<string, unknown>;
  hint?: string;
}

export interface CaptureConfirmRequest {
  kind: Exclude<CaptureKind, 'UNKNOWN'>;
  fields: Record<string, unknown>;
  idempotencyKey?: string;
  /** Original user text — server writes a QuickCapture audit row when present. */
  rawText?: string;
}

export interface CaptureConfirmResponse {
  kind: Exclude<CaptureKind, 'UNKNOWN'>;
  id: string;
  createdAt: string;
}

export const captureService = {
  parse(text: string, tz = 'Asia/Ho_Chi_Minh') {
    return apiClient.request<CaptureParseResponse>('POST', '/capture/parse', { text, tz });
  },
  confirm(input: CaptureConfirmRequest) {
    return apiClient.request<CaptureConfirmResponse>('POST', '/capture/confirm', input);
  },
};
