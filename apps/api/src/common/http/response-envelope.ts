/**
 * Wire format every endpoint MUST return.
 * Success paths use `success: true`; failures use `success: false`.
 */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  errorCode: null;
  message: string;
}

export interface ErrorEnvelope {
  success: false;
  data: null;
  errorCode: string;
  message: string;
  /** opaque per-request id for correlating with server logs */
  requestId?: string;
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export const ok = <T>(data: T, message = 'OK'): SuccessEnvelope<T> => ({
  success: true,
  data,
  errorCode: null,
  message,
});

export const err = (errorCode: string, message: string, requestId?: string): ErrorEnvelope => ({
  success: false,
  data: null,
  errorCode,
  message,
  ...(requestId ? { requestId } : {}),
});
