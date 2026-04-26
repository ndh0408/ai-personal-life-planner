import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  recommendationsService,
  type RecommendationPublic,
} from '../services/api/recommendations.service';

const KEY = ['recommendations'] as const;

export function useRecommendations() {
  return useQuery({ queryKey: KEY, queryFn: () => recommendationsService.list() });
}

export function useRefreshRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => recommendationsService.refresh(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRecommendationStatus() {
  const qc = useQueryClient();
  return useMutation<
    RecommendationPublic,
    unknown,
    { id: string; status: 'VIEWED' | 'DISMISSED' | 'APPLIED' }
  >({
    mutationFn: ({ id, status }) => recommendationsService.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Optimistic remove for DISMISSED so the card disappears immediately.
      if (status !== 'DISMISSED') return;
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<RecommendationPublic[]>(KEY);
      qc.setQueryData<RecommendationPublic[]>(KEY, (rows) =>
        (rows ?? []).filter((r) => r.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: RecommendationPublic[] } | undefined)?.prev;
      if (prev) qc.setQueryData(KEY, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
