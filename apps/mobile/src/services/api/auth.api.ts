import { api } from './client';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type Me = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  /** Round-18: ISO timestamp set when the user clicks the verify-email link.
   *  null ⇒ unverified, banner is shown. */
  emailVerifiedAt: string | null;
  profile: {
    fullName: string;
    age: number | null;
    gender: string | null;
    timezone: string;
    mainGoal: string | null;
    activityLevel: string | null;
  } | null;
};

export const authApi = {
  register: (input: { email: string; password: string; name?: string; timezone?: string }) =>
    api.post<AuthTokens>('/auth/register', input, { auth: false }),
  login: (input: { email: string; password: string }) =>
    api.post<AuthTokens>('/auth/login', input, { auth: false }),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<Me>('/users/me'),
  // Round 14
  resendVerification: (email: string) =>
    api.post<{ status: string }>('/auth/resend-verification', { email }, { auth: false }),
  verifyEmail: (token: string) =>
    api.post<{ alreadyVerified: boolean }>('/auth/verify-email', { token }, { auth: false }),
  forgotPassword: (email: string) =>
    api.post<{ status: string }>('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, password: string) =>
    api.post<void>('/auth/reset-password', { token, password }, { auth: false }),
};
