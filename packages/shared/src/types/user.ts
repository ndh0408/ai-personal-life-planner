import type { ID, ISODateString } from './common';

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type User = {
  id: ID;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type MainGoal =
  | 'LOSE_WEIGHT'
  | 'GAIN_WEIGHT'
  | 'SLEEP_EARLY'
  | 'PRODUCTIVE'
  | 'STUDY'
  | 'HEALTHY'
  | 'BALANCE';
export type ActivityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type UserProfile = {
  id: ID;
  userId: ID;
  fullName: string;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  occupation: string | null;
  mainGoal: MainGoal | null;
  activityLevel: ActivityLevel | null;
  dietaryPreference: string | null;
  healthNotes: string | null;
  timezone: string;
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
