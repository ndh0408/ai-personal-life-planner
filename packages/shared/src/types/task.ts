import type { ID, ISODateString } from './common';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export type Task = {
  id: ID;
  userId: ID;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: ISODateString | null;
  scheduledFor: ISODateString | null;
  estimatedMinutes: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
