import { EnergyService } from './energy.service';
import type { StressService } from './stress.service';
import type { PrismaService } from '../../prisma/prisma.service';

function fakePrisma(opts: {
  lastSleep?: { durationMinutes: number };
  sleep7?: Array<{ durationMinutes: number }>;
  lastMood?: { mood: string; energy: 'LOW' | 'MEDIUM' | 'HIGH' };
}): PrismaService {
  return {
    sleepLog: {
      findFirst: jest.fn(async () => opts.lastSleep ?? null),
      findMany: jest.fn(async () => opts.sleep7 ?? []),
    },
    moodLog: {
      findFirst: jest.fn(async () => opts.lastMood ?? null),
    },
  } as unknown as PrismaService;
}

function fakeStress(score: number): StressService {
  return {
    assess: jest.fn(async () => ({ score, reasons: [], components: {} })),
  } as unknown as StressService;
}

describe('EnergyService', () => {
  it('returns high level + 90-min focus on rested days', async () => {
    const svc = new EnergyService(
      fakePrisma({
        lastSleep: { durationMinutes: 7 * 60 + 30 },
        sleep7: [
          { durationMinutes: 7 * 60 + 30 },
          { durationMinutes: 7 * 60 },
          { durationMinutes: 8 * 60 },
        ],
        lastMood: { mood: 'GOOD', energy: 'HIGH' },
      }),
      fakeStress(0.1),
    );
    const r = await svc.assess('u1');
    expect(r.level).toBe('high');
    expect(r.recommendedFocusMinutes).toBe(90);
  });

  it('drops to low + 30-min focus on rough days', async () => {
    const svc = new EnergyService(
      fakePrisma({
        lastSleep: { durationMinutes: 4 * 60 + 30 },
        sleep7: [{ durationMinutes: 5 * 60 }, { durationMinutes: 5 * 60 + 30 }],
        lastMood: { mood: 'TIRED', energy: 'LOW' },
      }),
      fakeStress(0.7),
    );
    const r = await svc.assess('u1');
    expect(r.level).toBe('low');
    expect(r.recommendedFocusMinutes).toBe(30);
  });

  it('falls back to medium with no data', async () => {
    const svc = new EnergyService(fakePrisma({}), fakeStress(0));
    const r = await svc.assess('u1');
    expect(r.level).toBe('medium');
    expect(r.recommendedFocusMinutes).toBe(60);
  });
});
