import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  plannerService,
  type DailyPlanItemStatus,
  type DailyPlanPublic,
} from '../services/api/planner.service';

const KEY = ['daily-plan', 'today'] as const;

export function useTodayPlan() {
  return useQuery({ queryKey: KEY, queryFn: () => plannerService.today() });
}

export function useGenerateTodayPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => plannerService.generateToday(),
    onSuccess: (data) => qc.setQueryData<DailyPlanPublic | null>(KEY, data.plan),
  });
}

export function useSetItemStatus() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { id: string; status: DailyPlanItemStatus }>({
    mutationFn: ({ id, status }) => plannerService.setItemStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<DailyPlanPublic | null>(KEY);
      qc.setQueryData<DailyPlanPublic | null>(KEY, (cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          items: cur.items.map((i) => (i.id === id ? { ...i, status } : i)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: DailyPlanPublic | null } | undefined)?.prev;
      if (prev !== undefined) qc.setQueryData(KEY, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
