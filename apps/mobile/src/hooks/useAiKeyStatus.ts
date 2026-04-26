import { useQuery } from '@tanstack/react-query';
import { aiKeyService } from '../services/api/aiKey.service';
import { QK } from '../services/api/queryClient';

export function useAiKeyStatus() {
  return useQuery({
    queryKey: QK.aiKeyStatus,
    queryFn: () => aiKeyService.status(),
    staleTime: 30_000,
  });
}
