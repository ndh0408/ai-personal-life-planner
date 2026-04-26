import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/api/dashboard.service';

export const DASHBOARD_KEY = ['dashboard', 'summary'] as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => dashboardService.summary(),
    staleTime: 30_000,
  });
}
