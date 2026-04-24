import type { ID, ISODateString } from './common';
import type { Priority } from './task';

export type ScheduleItemType =
  | 'SLEEP'
  | 'MEAL'
  | 'WORK'
  | 'STUDY'
  | 'EXERCISE'
  | 'REST'
  | 'TASK'
  | 'TRAVEL'
  | 'CUSTOM';

export type ScheduleItemStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'DELAYED';

export type DailyScheduleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Mood = 'HAPPY' | 'NORMAL' | 'STRESSED' | 'TIRED' | 'SAD' | 'MOTIVATED';

export type ScheduleItem = {
  id: ID;
  scheduleId: ID;
  userId: ID;
  title: string;
  description: string | null;
  startTime: ISODateString;
  endTime: ISODateString;
  type: ScheduleItemType;
  priority: Priority;
  status: ScheduleItemStatus;
  aiGenerated: boolean;
  reason: string | null;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DailySchedule = {
  id: ID;
  userId: ID;
  date: string;
  wakeUpTime: string | null;
  sleepTime: string | null;
  summary: string | null;
  energyLevel: EnergyLevel | null;
  mood: Mood | null;
  aiGenerated: boolean;
  status: DailyScheduleStatus;
  items: ScheduleItem[];
};
