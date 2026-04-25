import { PrivacyService } from './privacy.service';

function makePrisma() {
  const settingsRows = new Map<string, any>();
  const consentRows: any[] = [];
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
          const next = existing ? { ...existing, ...update, updatedAt: new Date() } : {
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
  };
}

describe('PrivacyService', () => {
  it('returns conservative defaults when the user has no row yet', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    const s = await svc.getSettings('u1');
    expect(s.personalizationEnabled).toBe(true);
    expect(s.useScheduleForAI).toBe(true);
    expect(s.useFinanceForAI).toBe(true);
    expect(s.useHealthForAI).toBe(true);
    expect(s.useMealForAI).toBe(true);
    // device-permission gates default OFF
    expect(s.useCalendarContext).toBe(false);
    expect(s.useLocationContext).toBe(false);
    expect(s.useHealthFitnessContext).toBe(false);
    expect(s.voiceInputEnabled).toBe(false);
    // diagnostics opt-in
    expect(s.anonymizedDiagnostics).toBe(false);
    // No row was written for a pure read.
    expect(api.privacySetting.upsert).not.toHaveBeenCalled();
  });

  it('updateSettings upserts and round-trips', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    const r = await svc.updateSettings('u1', {
      useFinanceForAI: false,
      useLocationContext: true,
    });
    expect(r.useFinanceForAI).toBe(false);
    expect(r.useLocationContext).toBe(true);
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
    expect(gates.personalization).toBe(false);
  });

  it('recordConsent grant + revoke writes two rows and marks the prior one revoked', async () => {
    const { api, consentRows } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.recordConsent('u1', {
      consentType: 'AI_PROCESSING',
      granted: true,
      version: 'v1',
    });
    await svc.recordConsent('u1', {
      consentType: 'AI_PROCESSING',
      granted: false,
      version: 'v1',
    });
    expect(consentRows).toHaveLength(2);
    expect(consentRows[0].granted).toBe(true);
    expect(consentRows[0].revokedAt).toBeInstanceOf(Date);
    expect(consentRows[1].granted).toBe(false);
  });

  it('dataUsageSummary reflects what AI currently sees and counts owned rows', async () => {
    const { api } = makePrisma();
    const svc = new PrivacyService(api as never);
    await svc.updateSettings('u1', { useHealthForAI: false });
    const s = await svc.dataUsageSummary('u1');
    expect(s.aiSeesSchedule).toBe(true);
    expect(s.aiSeesHealth).toBe(false);
    expect(s.storedCounts).toEqual({
      schedules: 1,
      tasks: 2,
      expenses: 3,
      incomes: 4,
      sleepLogs: 5,
      moodLogs: 6,
      healthMetrics: 7,
      aiMessages: 8,
    });
  });
});
