import type { ID, ISODateString } from './common';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type Task = {
  id: ID;
  userId: ID;
  title: string;
  description: string | null;
  dueDate: ISODateString | null;
  priority: Priority;
  estimatedMinutes: number | null;
  status: TaskStatus;
  category: string | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
