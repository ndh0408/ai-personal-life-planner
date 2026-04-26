import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/api/health.service';
import { QK } from '../services/api/queryClient';

export function useHealth() {
  return useQuery({
    queryKey: QK.health,
    queryFn: () => healthService.probe(),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}
