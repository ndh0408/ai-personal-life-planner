import { apiClient } from '../api/client';

export interface UserPublic {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

export const authService = {
  register(input: { email: string; password: string; displayName?: string }) {
    return apiClient.request<AuthResponse>('POST', '/auth/register', input, { auth: false });
  },
  login(input: { email: string; password: string }) {
    return apiClient.request<AuthResponse>('POST', '/auth/login', input, { auth: false });
  },
  logout(refreshToken?: string) {
    return apiClient.request<void>('POST', '/auth/logout', { refreshToken });
  },
  me() {
    return apiClient.request<UserPublic>('GET', '/me');
  },
};
