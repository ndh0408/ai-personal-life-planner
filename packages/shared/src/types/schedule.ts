import type { ID, ISODateString } from './common';

export type ScheduleBlockKind =
  | 'task'
  | 'meal'
  | 'sleep'
  | 'exercise'
  | 'focus'
  | 'break'
  | 'custom';

export type ScheduleBlock = {
  id: ID;
  userId: ID;
  kind: ScheduleBlockKind;
  title: string;
  startAt: ISODateString;
  endAt: ISODateString;
  taskId: ID | null;
  notes: string | null;
};

export type DailyPlan = {
  date: string;
  wakeAt: ISODateString;
  sleepAt: ISODateString;
  blocks: ScheduleBlock[];
};
