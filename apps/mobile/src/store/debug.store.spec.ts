import { useDebugStore } from './debug.store';

describe('useDebugStore', () => {
  beforeEach(() => {
    useDebugStore.getState().reset();
  });

  it('starts empty', () => {
    expect(useDebugStore.getState().lastParse).toBeNull();
    expect(useDebugStore.getState().lastApiError).toBeNull();
  });

  it('records a parse snapshot', () => {
    useDebugStore.getState().recordParse({
      rawText: 'phở 60k',
      kind: 'EXPENSE',
      source: 'RULE',
      confidence: 0.92,
      needsReview: false,
      at: 1700000000000,
    });
    const state = useDebugStore.getState();
    expect(state.lastParse?.rawText).toBe('phở 60k');
    expect(state.lastParse?.kind).toBe('EXPENSE');
  });

  it('records an API error snapshot', () => {
    useDebugStore.getState().recordApiError({
      status: 401,
      errorCode: 'invalid_token',
      message: 'token expired',
      path: '/auth/me',
      at: 1700000001000,
    });
    expect(useDebugStore.getState().lastApiError?.status).toBe(401);
  });

  it('reset() clears both fields', () => {
    useDebugStore.getState().recordParse({
      rawText: 'x',
      kind: 'TASK',
      source: 'RULE',
      confidence: 0.5,
      needsReview: true,
      at: 1,
    });
    useDebugStore.getState().reset();
    expect(useDebugStore.getState().lastParse).toBeNull();
    expect(useDebugStore.getState().lastApiError).toBeNull();
  });
});
