export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  errorCode: null;
  message: string;
}
export interface ApiError {
  success: false;
  data: null;
  errorCode: string;
  message: string;
  requestId?: string;
}
export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;
