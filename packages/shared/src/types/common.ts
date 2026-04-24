export type ID = string;

export type ISODateString = string;

export type Pagination = {
  page: number;
  pageSize: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ApiError = {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
};
