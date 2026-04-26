import { apiClient } from './client';

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  currency: 'VND';
  category: string;
  expenseDate: string;
  walletId: string;
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

export const financeService = {
  list(range?: 'today' | 'yesterday' | 'week' | 'month') {
    const qs = range ? `?range=${range}` : '';
    return apiClient.request<ExpenseListResponse>('GET', `/expenses${qs}`);
  },
  summary() {
    return apiClient.request<ExpenseSummary>('GET', '/expenses/summary');
  },
};
