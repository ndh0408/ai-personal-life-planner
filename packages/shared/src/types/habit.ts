import type { ID, ISODateString } from './common';

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export type Habit = {
  id: ID;
  userId: ID;
  name: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  createdAt: ISODateString;
};

export type HabitLog = {
  id: ID;
  habitId: ID;
  completedAt: ISODateString;
  note: string | null;
};
