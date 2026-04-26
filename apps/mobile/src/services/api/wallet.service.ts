import { apiClient } from './client';

export interface WalletRow {
  id: string;
  name: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateWalletInput {
  name: string;
  initialBalance?: number;
  currency?: string;
  isDefault?: boolean;
}

export const walletService = {
  list() {
    return apiClient.request<WalletRow[]>('GET', '/wallets');
  },
  getDefault() {
    return apiClient.request<WalletRow>('GET', '/wallets/default');
  },
  create(input: CreateWalletInput) {
    return apiClient.request<WalletRow>('POST', '/wallets', input);
  },
};
