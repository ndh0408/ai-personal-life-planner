import { apiClient } from './client';

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  currency: 'VND';
  category: string;
  expenseDate: string;
  walletId: string;
  note: string | null;
  createdAt: string;
}

export interface ExpenseListResponse {
  range: string | null;
  total: number;
  totalAmount: number;
  rows: ExpenseRow[];
}

export interface ExpenseSummary {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  weekByCategory: Array<{ category: string; amount: number }>;
  currency: 'VND';
}

export interface TimelineEntry {
  id: string;
  kind: 'EXPENSE' | 'INCOME';
  title: string;
  amount: number;
  category: string;
  occurredAt: string;
  walletId: string;
  note: string | null;
}

export interface TimelineResponse {
  range: string | null;
  totalIncome: number;
  totalExpense: number;
  net: number;
  rows: TimelineEntry[];
}

export interface IncomeRow {
  id: string;
  title: string;
  amount: number;
  currency: 'VND';
  category: string;
  incomeDate: string;
  walletId: string;
  note: string | null;
  createdAt: string;
}

export interface IncomeListResponse {
  range: string | null;
  total: number;
  totalAmount: number;
  rows: IncomeRow[];
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  category: string;
  expenseDateIso: string;
  walletId?: string;
  note?: string | null;
  /** Sent as the Idempotency-Key header so a tap-spammed Save still creates one row. */
  idempotencyKey?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  amount?: number;
  category?: string;
  expenseDateIso?: string;
  note?: string | null;
}

export const financeService = {
  list(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<ExpenseListResponse>('GET', `/expenses${qs}`);
  },
  summary() {
    return apiClient.request<ExpenseSummary>('GET', '/expenses/summary');
  },
  create(input: CreateExpenseInput) {
    const { idempotencyKey, ...body } = input;
    return apiClient.request<ExpenseRow>('POST', '/expenses', body, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  },
  update(id: string, input: UpdateExpenseInput) {
    return apiClient.request<ExpenseRow>('PUT', `/expenses/${id}`, input);
  },
  remove(id: string) {
    return apiClient.request<{ id: string }>('DELETE', `/expenses/${id}`);
  },
  timeline(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<TimelineResponse>('GET', `/finance/timeline${qs}`);
  },
};

export const incomeService = {
  list(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<IncomeListResponse>('GET', `/incomes${qs}`);
  },
  remove(id: string) {
    return apiClient.request<{ id: string }>('DELETE', `/incomes/${id}`);
  },
};
