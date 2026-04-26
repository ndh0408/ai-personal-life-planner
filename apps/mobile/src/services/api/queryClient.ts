import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const QK = {
  me: ['me'] as const,
  health: ['health'] as const,
  aiKeyStatus: ['ai-key', 'status'] as const,
  homeStats: ['home', 'stats'] as const,
};
