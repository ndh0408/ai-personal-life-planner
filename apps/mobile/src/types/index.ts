// Re-export shared domain types as the mobile-side surface.
export * from '@planner/shared';

export type ApiEnvelope<T = unknown> = {
  success: true;
  data: T;
  message: string;
};

export type ApiErrorBody = {
  success: false;
  message: string;
  issues?: Array<{ path: string; message: string }>;
  statusCode?: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
