import { PrivacyService } from './privacy.service';

function makePrisma() {
  const settingsRows = new Map<string, any>();
  const consentRows: any[] = [];
  const accessLogs: any[] = [];
  const evidenceRows: any[] = [];
  const memoryRows: any[] = [];

  const tx = {
    userConsent: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of consentRows) {
          if (
            r.userId === where.userId &&
            r.consentType === where.consentType &&
            r.granted === where.granted &&
            r.revokedAt === where.revokedAt
          ) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `c-${consentRows.length + 1}`,
          ...data,
          grantedAt: new Date(),
          revokedAt: null,
          metadata: data.metadata ?? null,
        };
        consentRows.push(row);
        return { id: row.id };
      }),
    },
  };

  return {
    api: {
      privacySetting: {
        findUnique: jest.fn(async ({ where }: any) => settingsRows.get(where.userId) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = settingsRows.get(where.userId);
          const next = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : {
                id: `s-${settingsRows.size + 1}`,
                ...create,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
          settingsRows.set(where.userId, next);
          return next;
        }),
      },
      userConsent: {
        findMany: jest.fn(async ({ where }: any) =>
          consentRows.filter((r) => r.userId === where.userId),
        ),
      },
      sensitiveAccessLog: {
        create: jest.fn(async ({ data }: any) => {
          const r = { id: `a-${accessLogs.length + 1}`, ...data, createdAt: new Date() };
          accessLogs.push(r);
          return r;
        }),
        groupBy: jest.fn(async ({ where }: any) => {
          const filtered = accessLogs.filter((r) => r.userId === where.userId);
          const groups = new Map<string, Date>();
          for (const r of filtered) {
            const prev = groups.get(r.dataType);
            if (!prev || r.createdAt > prev) groups.set(r.dataType, r.createdAt);
          }
          return [...groups.entries()].map(([dataType, createdAt]) => ({
            dataType,
            _max: { createdAt },
          }));
        }),
      },
      recommendationEvidence: {
        createMany: jest.fn(async ({ data }: any) => {
          const arr = Array.isArray(data) ? data : [data];
          for (const d of arr) {
            evidenceRows.push({
              id: `e-${evidenceRows.length + 1}`,
              ...d,
              createdAt: new Date(),
            });
          }
          return { count: arr.length };
        }),
        findMany: jest.fn(async ({ where }: any) =>
          evidenceRows.filter(
            (r) => r.userId === where.userId && r.recommendationId === where.recommendationId,
          ),
        ),
      },
      aiPersonalizationMemory: {
        create: jest.fn(async ({ data }: any) => {
          const r = { id: `m-${memoryRows.length + 1}`, ...data, isActive: true, createdAt: new Date(), updatedAt: new Date() };
          memoryRows.push(r);
          return r;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const r of memoryRows) {
            if (r.userId === where.userId && r.isActive === where.isActive) {
              Object.assign(r, data);
              count++;
            }
          }
          return { count };
        }),
      },
      dailySchedule: { count: jest.fn(async () => 1) },
      task: { count: jest.fn(async () => 2) },
      expense: { count: jest.fn(async () => 3) },
      income: { count: jest.fn(async () => 4) },
      sleepLog: { count: jest.fn(async () => 5) },
      moodLog: { count: jest.fn(async () => 6) },
      healthMetric: { count: jest.fn(async () => 7) },
      aIMessage: { count: jest.fn(async () => 8) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    },
    consentRows,
    settingsRows,
    accessLogs,
    evidenceRows,
    memoryRows,
  };
}

describe('PrivacyService', () => {
  it('returns conservative defaults when the user has no row yet', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    const s = await svc.getSettings('u1');
    expect(s.personalizationEnabled).toBe(true);
    expect(s.useScheduleForAI).toBe(true);
    expect(s.useTasksForAI).toBe(true);
    expect(s.useHabitsForAI).toBe(true);
    expect(s.useMealsForAI).toBe(true);
    expect(s.useFinanceForAI).toBe(true);
    expect(s.useHealthForAI).toBe(true);
    expect(s.useGoalsForAI).toBe(true);
    expect(s.useCalendarContext).toBe(false);
    expect(s.useLocationContext).toBe(false);
    expect(s.useHealthFitnessContext).toBe(false);
    expect(s.voiceInputEnabled).toBe(false);
    expect(s.anonymizedDiagnostics).toBe(false);
    expect(api.privacySetting.upsert).not.toHaveBeenCalled();
  });

  it('updateSettings normalises useVoiceInput → voiceInputEnabled and useMealsForAI ⇆ useMealForAI', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    const r = await svc.updateSettings('u1', {
      useVoiceInput: true,
      useMealsForAI: false,
    });
    expect(r.voiceInputEnabled).toBe(true);
    expect(r.useMealForAI).toBe(false);
  });

  it('aiGates compounds personalization with each domain toggle', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.updateSettings('u1', {
      personalizationEnabled: false,
      useFinanceForAI: true,
    });
    const gates = await svc.aiGates('u1');
    expect(gates.finance).toBe(false);
    expect(gates.health).toBe(false);
    expect(gates.tasks).toBe(false);
    expect(gates.personalization).toBe(false);
  });

  it('recordConsent grant + revoke writes two rows and back-fills revokedAt', async () => {
    const { api, consentRows } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.recordConsent('u1', { consentType: 'AI_PROCESSING', granted: true, version: 'v1' });
    await svc.recordConsent('u1', { consentType: 'AI_PROCESSING', granted: false, version: 'v1' });
    expect(consentRows).toHaveLength(2);
    expect(consentRows[0].granted).toBe(true);
    expect(consentRows[0].revokedAt).toBeInstanceOf(Date);
    expect(consentRows[1].granted).toBe(false);
  });

  it('logAccess writes a metadata-only audit row and never throws on DB outage', async () => {
    const { api, accessLogs } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.logAccess('u1', 'FINANCE', 'ai-finance:analyze', 'AiFinanceService', 'POST /api/ai/analyze-finance');
    expect(accessLogs).toHaveLength(1);
    expect(accessLogs[0].dataType).toBe('FINANCE');
    expect(accessLogs[0].purpose).toBe('ai-finance:analyze');
    // No raw payload fields exist on the log row.
    expect(Object.keys(accessLogs[0]).sort()).toEqual(
      ['accessedBy', 'createdAt', 'dataType', 'id', 'purpose', 'sourceFeature', 'userId'].sort(),
    );

    api.sensitiveAccessLog.create.mockRejectedValueOnce(new Error('DB down'));
    await expect(
      svc.logAccess('u1', 'FINANCE', 'p', 'X', 'POST /'),
    ).resolves.toBeUndefined();
  });

  it('dataUsageSummary surfaces lastAccess from SensitiveAccessLog groupBy', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.logAccess('u1', 'FINANCE', 'p', 'X', 'POST');
    await svc.logAccess('u1', 'HEALTH', 'p', 'X', 'POST');
    const s = await svc.dataUsageSummary('u1');
    expect(s.aiSeesSchedule).toBe(true);
    expect(s.aiSeesTasks).toBe(true);
    expect(s.aiSeesGoals).toBe(true);
    expect(s.lastAccess.FINANCE).toBeTruthy();
    expect(s.lastAccess.HEALTH).toBeTruthy();
    expect(s.lastAccess.LOCATION).toBeUndefined();
  });

  it('addRecommendationEvidence stores summaries (no raw payload)', async () => {
    const { api, evidenceRows } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.addRecommendationEvidence('rec-1', 'u1', [
      { dataType: 'HEALTH', summary: 'Bạn ngủ 5h30 hôm qua.', locale: 'vi', weight: 0.8 },
      { dataType: 'TASKS', summary: 'Còn 4 task pending.', locale: 'vi', weight: 0.6 },
    ]);
    expect(evidenceRows).toHaveLength(2);
    expect(evidenceRows[0].summary).toMatch(/5h30/);
    expect(evidenceRows[1].summary).toMatch(/4 task/);
    // Confirm raw fields don't bleed in.
    for (const r of evidenceRows) {
      expect(r).not.toHaveProperty('amount');
      expect(r).not.toHaveProperty('rawNote');
      expect(r).not.toHaveProperty('payload');
    }
  });

  it('clearAiMemory soft-clears active memories and reports the count', async () => {
    const { api, memoryRows } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.upsertMemory('u1', 'PREFERENCE', 'prefers light dinners', 'chat:2026-04-25');
    await svc.upsertMemory('u1', 'PATTERN', 'tends to skip habit on Sundays', 'daily-review');
    expect(memoryRows.filter((r) => r.isActive)).toHaveLength(2);
    const r = await svc.clearAiMemory('u1');
    expect(r.cleared).toBe(2);
    expect(memoryRows.filter((r) => r.isActive)).toHaveLength(0);
    // Rows are NOT hard-deleted — audit trail preserved.
    expect(memoryRows).toHaveLength(2);
  });
});
