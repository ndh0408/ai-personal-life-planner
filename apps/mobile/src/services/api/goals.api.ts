import { api } from './client';

export type GoalCategory =
  | 'HEALTH'
  | 'FINANCE'
  | 'CAREER'
  | 'STUDY'
  | 'RELATIONSHIP'
  | 'PERSONAL'
  | 'OTHER';

export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';

export type MilestoneStatus = 'TODO' | 'COMPLETED' | 'CANCELLED';

export type GoalMilestone = {
  id: string;
  goalId: string;
  title: string;
  targetDate: string | null;
  completedAt: string | null;
  status: MilestoneStatus;
};

export type PersonalGoal = {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  deadline: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: GoalStatus;
  milestones: GoalMilestone[];
};

export type CreateGoalInput = {
  title: string;
  description?: string;
  category: GoalCategory;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  deadline?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export const goalsApi = {
  list: () => api.get<PersonalGoal[]>('/goals'),
  getById: (id: string) => api.get<PersonalGoal>(`/goals/${id}`),
  create: (body: CreateGoalInput) => api.post<PersonalGoal>('/goals', body),
  update: (id: string, body: Partial<CreateGoalInput> & { status?: GoalStatus }) =>
    api.put<PersonalGoal>(`/goals/${id}`, body),
  remove: (id: string) => api.delete(`/goals/${id}`),
  addMilestone: (goalId: string, body: { title: string; targetDate?: string }) =>
    api.post<GoalMilestone>(`/goals/${goalId}/milestones`, body),
  patchMilestoneStatus: (id: string, status: MilestoneStatus) =>
    api.patch<GoalMilestone>(`/goal-milestones/${id}/status`, { status }),
  removeMilestone: (id: string) => api.delete(`/goal-milestones/${id}`),
};
