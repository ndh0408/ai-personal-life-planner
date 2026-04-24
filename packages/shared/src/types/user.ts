import type { ID, ISODateString } from './common';

export type User = {
  id: ID;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthSession = {
  user: User;
  tokens: AuthTokens;
};
