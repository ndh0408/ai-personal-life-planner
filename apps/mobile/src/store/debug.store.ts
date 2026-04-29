/**
 * Lightweight in-memory debug ring (round 23). Records the last parse +
 * the last API error so the hidden DevPanel can show them when the user
 * comes hunting for "why did this break."
 *
 * Not persisted — we don't want a debug log surviving an app restart and
 * later leaking through a screenshot. Cleared on logout via apiClient
 * teardown listener (registered in App.tsx).
 */
import { create } from 'zustand';

export interface LastParseSnapshot {
  rawText: string;
  kind: string;
  source: string;
  confidence: number;
  needsReview: boolean;
  at: number; // epoch ms
}

export interface LastApiError {
  status: number | null;
  errorCode: string | null;
  message: string;
  path: string;
  at: number;
}

interface DebugState {
  lastParse: LastParseSnapshot | null;
  lastApiError: LastApiError | null;
  recordParse: (s: LastParseSnapshot) => void;
  recordApiError: (e: LastApiError) => void;
  reset: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  lastParse: null,
  lastApiError: null,
  recordParse: (s) => set({ lastParse: s }),
  recordApiError: (e) => set({ lastApiError: e }),
  reset: () => set({ lastParse: null, lastApiError: null }),
}));
