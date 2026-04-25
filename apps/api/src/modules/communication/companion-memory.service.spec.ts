import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanionMemoryService } from './companion-memory.service';
import type { CommunicationSettingsService } from './communication-settings.service';

function makePrisma() {
  const rows: any[] = [];
  let i = 0;
  return {
    rows,
    api: {
      aICompanionMemory: {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter((r) => r.userId === where.userId),
        ),
        findUnique: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
        create: jest.fn(async ({ data }: any) => {
          const r = {
            id: `m-${++i}`,
            ...data,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastUsedAt: null,
          };
          rows.push(r);
          return r;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const r = rows.find((x) => x.id === where.id);
          Object.assign(r, data, { updatedAt: new Date() });
          return r;
        }),
        delete: jest.fn(async ({ where }: any) => {
          const idx = rows.findIndex((x) => x.id === where.id);
          rows.splice(idx, 1);
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const r of rows) {
            if (r.userId === where.userId && r.isActive === where.isActive) {
              Object.assign(r, data);
              count++;
            }
          }
          return { count };
        }),
      },
    },
  };
}

function settingsStub(aiMemoryEnabled = true): CommunicationSettingsService {
  return { getSettings: async () => ({ aiMemoryEnabled }) } as unknown as CommunicationSettingsService;
}

describe('CompanionMemoryService', () => {
  it('refuses to create memory when aiMemoryEnabled is false', async () => {
    const { api } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(false));
    await expect(
      svc.create('u1', { memoryType: 'PREFERENCE', content: 'x', source: 'CHAT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to create sensitive memory without userConfirmed', async () => {
    const { api } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(true));
    await expect(
      svc.create('u1', { memoryType: 'HEALTH_CONTEXT', content: 'x', source: 'CHAT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.create('u1', { memoryType: 'FINANCE_CONTEXT', content: 'x', source: 'CHAT' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts sensitive memory when caller passes userConfirmed=true', async () => {
    const { api } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(true));
    const r = await svc.create(
      'u1',
      { memoryType: 'HEALTH_CONTEXT', content: 'low energy on Mondays', source: 'USER_CONFIRMATION' },
      true,
    );
    expect(r.memoryType).toBe('HEALTH_CONTEXT');
  });

  it('refuses cross-user update / delete (IDOR)', async () => {
    const { api } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(true));
    const r = await svc.create('u1', { memoryType: 'PREFERENCE', content: 'a', source: 'CHAT' });
    await expect(svc.update('u2', r.id, { content: 'hax' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.delete('u2', r.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns NotFound for unknown id', async () => {
    const { api } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(true));
    await expect(svc.delete('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clearAll soft-clears active rows and reports the count', async () => {
    const { api, rows } = makePrisma();
    const svc = new CompanionMemoryService(api as never, settingsStub(true));
    await svc.create('u1', { memoryType: 'PREFERENCE', content: 'a', source: 'CHAT' });
    await svc.create('u1', { memoryType: 'HABIT', content: 'b', source: 'CHAT' });
    const r = await svc.clearAll('u1');
    expect(r.cleared).toBe(2);
    expect(rows.filter((x) => x.isActive)).toHaveLength(0);
    // Audit trail preserved.
    expect(rows).toHaveLength(2);
  });
});
