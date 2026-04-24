import type { ID, ISODateString } from './common';

export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM';

export type Habit = {
  id: ID;
  userId: ID;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  targetCount: number;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type HabitLog = {
  id: ID;
  habitId: ID;
  userId: ID;
  date: string;
  completed: boolean;
  count: number;
  note: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
