import { apiClient } from './client';

export type CaptureKind = 'EXPENSE' | 'MEAL' | 'TASK' | 'SLEEP' | 'MOOD' | 'UNKNOWN';
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
