import { api } from './client';
import type { UpdateProfileInput } from '@planner/shared';

export type ProfileResponse = {
  profile: {
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
    timezone: string;
  } | null;
  exists: boolean;
};

export const profileApi = {
  get: () => api.get<ProfileResponse>('/profile'),
  update: (input: UpdateProfileInput) =>
    api.put<ProfileResponse['profile']>('/profile', input),
};
