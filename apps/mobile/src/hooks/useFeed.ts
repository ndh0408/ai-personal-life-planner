/**
 * Read-side hooks for the Today / Money / Home screens.
 * Centralised query keys + invalidator so the Quick Capture confirm flow
 * can drop one helper call to refresh everything at once.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { journalService } from '../services/api/journal.service';
import { tasksService } from '../services/api/tasks.service';

export const FEED_KEYS = {
  tasksToday: ['tasks', 'today'] as const,
  mealsToday: ['meals', 'today'] as const,
  sleepLatest: ['sleep', 'latest'] as const,
  moodLatest: ['mood', 'latest'] as const,
};

export function useTodayTasks() {
  return useQuery({ queryKey: FEED_KEYS.tasksToday, queryFn: () => tasksService.list('today') });
}

export function useTodayMeals() {
  return useQuery({ queryKey: FEED_KEYS.mealsToday, queryFn: () => journalService.meals('today') });
}

export function useLatestSleep() {
  return useQuery({ queryKey: FEED_KEYS.sleepLatest, queryFn: () => journalService.latestSleep() });
}

export function useLatestMood() {
  return useQuery({ queryKey: FEED_KEYS.moodLatest, queryFn: () => journalService.latestMood() });
}

/**
 * Single helper to refresh everything after a Quick Capture / SmartEntry
 * confirm. Symmetric with SmartEntryScreen invalidations — both paths
 * invalidate the same set so timeline + dashboard + wallet always re-fetch.
 */
export function useFeedInvalidator() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['incomes'] });
    qc.invalidateQueries({ queryKey: ['finance'] });
    qc.invalidateQueries({ queryKey: ['meals'] });
    qc.invalidateQueries({ queryKey: ['sleep'] });
    qc.invalidateQueries({ queryKey: ['mood'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['wallets'] });
  };
}
