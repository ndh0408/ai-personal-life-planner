import { api } from './client';

export type ScheduleItem = {
  id: string;
  scheduleId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  type: string;
  priority: string;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'DELAYED';
  reason: string | null;
  sortOrder: number;
};

export type DailySchedule = {
  id: string;
  userId: string;
  date: string;
  wakeUpTime: string | null;
  sleepTime: string | null;
  summary: string | null;
  status: string;
  aiGenerated: boolean;
  items: ScheduleItem[];
};

export const schedulesApi = {
  byDate: (date: string) => api.get<DailySchedule | null>(`/schedules?date=${date}`),
  setItemStatus: (id: string, status: ScheduleItem['status']) =>
    api.patch<ScheduleItem>(`/schedule-items/${id}/status`, { status }),
};
