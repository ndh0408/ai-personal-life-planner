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
};
