import { api } from './client';

// ---- wallets ---------------------------------------------------------------

export type WalletType = 'CASH' | 'BANK' | 'EWALLET' | 'SAVINGS' | 'OTHER';

export type Wallet = {
  id: string;
  name: string;
  type: WalletType;
  balance: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
};

export type CreateWalletInput = {
  name: string;
  type: WalletType;
  balance?: number;
  currency?: string;
};

export const walletsApi = {
  list: () => api.get<Wallet[]>('/wallets'),
  create: (body: CreateWalletInput) => api.post<Wallet>('/wallets', body),
  update: (id: string, body: Partial<CreateWalletInput> & { isActive?: boolean }) =>
    api.put<Wallet>(`/wallets/${id}`, body),
  remove: (id: string) => api.delete(`/wallets/${id}`),
};

// ---- incomes ---------------------------------------------------------------

export type Income = {
  id: string;
  walletId: string | null;
  title: string;
  amount: string;
  category: string | null;
  source: string | null;
  incomeDate: string;
  isRecurring: boolean;
  note: string | null;
};

export type CreateIncomeInput = {
  walletId?: string | null;
  title: string;
  amount: number;
  category?: string;
  source?: string;
  incomeDate: string;
  isRecurring?: boolean;
  note?: string;
};

export const incomesApi = {
  list: (params?: { from?: string; to?: string; category?: string }) =>
    api.get<Income[]>(`/incomes${qs(params)}`),
  create: (body: CreateIncomeInput) => api.post<Income>('/incomes', body),
  update: (id: string, body: Partial<CreateIncomeInput>) =>
    api.put<Income>(`/incomes/${id}`, body),
  remove: (id: string) => api.delete(`/incomes/${id}`),
};

// ---- expenses --------------------------------------------------------------

export type NeedLevel = 'NEED' | 'WANT' | 'WASTE' | 'INVESTMENT' | 'SAVING';

export type Expense = {
  id: string;
  walletId: string | null;
  title: string;
  amount: string;
  category: string;
  expenseDate: string;
  paymentMethod: string | null;
  needLevel: NeedLevel | null;
  note: string | null;
};

export type CreateExpenseInput = {
  walletId?: string | null;
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod?: string;
  needLevel?: NeedLevel;
  note?: string;
};

export type ListExpensesQuery = {
  from?: string;
  to?: string;
  category?: string;
  needLevel?: NeedLevel;
  page?: number;
  limit?: number;
};

export type PaginatedExpenses = {
  items: Expense[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const expensesApi = {
  list: (params?: ListExpensesQuery) =>
    api.get<PaginatedExpenses>(`/expenses${qs(params)}`),
  create: (body: CreateExpenseInput) => api.post<Expense>('/expenses', body),
  update: (id: string, body: Partial<CreateExpenseInput>) =>
    api.put<Expense>(`/expenses/${id}`, body),
  remove: (id: string) => api.delete(`/expenses/${id}`),
};

// ---- budgets ---------------------------------------------------------------

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY';

export type Budget = {
  id: string;
  category: string;
  amount: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  alertThresholdPercent: number;
  usage: {
    spent: number;
    remaining: number;
    usedPercent: number;
    overThreshold: boolean;
  };
};

export type CreateBudgetInput = {
  category: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  alertThresholdPercent?: number;
};

export const budgetsApi = {
  list: () => api.get<Budget[]>('/budgets'),
  create: (body: CreateBudgetInput) => api.post<Budget>('/budgets', body),
  update: (id: string, body: Partial<CreateBudgetInput>) =>
    api.put<Budget>(`/budgets/${id}`, body),
  remove: (id: string) => api.delete(`/budgets/${id}`),
};

// ---- debts -----------------------------------------------------------------

export type DebtType = 'I_OWE' | 'OWED_TO_ME';
export type DebtStatus = 'ACTIVE' | 'PAID' | 'CANCELLED';

export type Debt = {
  id: string;
  type: DebtType;
  personName: string | null;
  title: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string | null;
  status: DebtStatus;
  note: string | null;
};

export type CreateDebtInput = {
  type: DebtType;
  personName?: string;
  title: string;
  totalAmount: number;
  paidAmount?: number;
  dueDate?: string;
  note?: string;
};

export const debtsApi = {
  list: () => api.get<Debt[]>('/debts'),
  create: (body: CreateDebtInput) => api.post<Debt>('/debts', body),
  update: (id: string, body: Partial<CreateDebtInput> & { status?: DebtStatus }) =>
    api.put<Debt>(`/debts/${id}`, body),
  pay: (id: string, amount: number, markPaid?: boolean) =>
    api.patch<Debt>(`/debts/${id}/payment`, { amount, markPaid }),
  remove: (id: string) => api.delete(`/debts/${id}`),
};

// ---- saving goals ----------------------------------------------------------

export type SavingGoalStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type SavingGoal = {
  id: string;
  title: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: SavingGoalStatus;
  note: string | null;
};

export type CreateSavingGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  note?: string;
};

export const savingGoalsApi = {
  list: () => api.get<SavingGoal[]>('/saving-goals'),
  create: (body: CreateSavingGoalInput) => api.post<SavingGoal>('/saving-goals', body),
  update: (id: string, body: Partial<CreateSavingGoalInput> & { status?: SavingGoalStatus }) =>
    api.put<SavingGoal>(`/saving-goals/${id}`, body),
  contribute: (id: string, amount: number) =>
    api.patch<SavingGoal>(`/saving-goals/${id}/contribute`, { amount }),
  remove: (id: string) => api.delete(`/saving-goals/${id}`),
};

// ---- helper ----------------------------------------------------------------

function qs(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}
