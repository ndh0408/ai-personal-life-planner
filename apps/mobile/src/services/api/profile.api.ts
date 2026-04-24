import { api } from './client';
import type { UpdateProfileInput } from '@planner/shared';

export type ProfilePayload = {
  id: string;
  userId: string;
  fullName: string;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  occupation: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  usualWakeTime: string | null;
  usualSleepTime: string | null;
  mainGoal: string | null;
  activityLevel: string | null;
  dietaryPreference: string | null;
  healthNotes: string | null;
  monthlySalary: string | number | null;
  salaryDay: number | null;
  currency: string;
  timezone: string;
  locale: string;
};

export type ProfileResponse = {
  profile: ProfilePayload | null;
  exists: boolean;
};

export const profileApi = {
  get: () => api.get<ProfileResponse>('/profile'),
  update: (input: UpdateProfileInput) => api.put<ProfilePayload>('/profile', input),
};
