import { ProfileService } from './profile.service';

type MockProfile = {
  id: string;
  userId: string;
  fullName: string;
  workStartTime: Date | null;
  workEndTime: Date | null;
  usualWakeTime: Date | null;
  usualSleepTime: Date | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  occupation: string | null;
  mainGoal: string | null;
  activityLevel: string | null;
  dietaryPreference: string | null;
  healthNotes: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

function makePrisma() {
  const rows = new Map<string, MockProfile>();
  return {
    userProfile: {
      findUnique: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          Array.from(rows.values()).find((p) => p.userId === where.userId) ?? null,
        ),
      ),
      create: jest.fn(({ data }: { data: Partial<MockProfile> & { userId: string } }) => {
        const profile: MockProfile = {
          id: `p-${rows.size + 1}`,
          userId: data.userId,
          fullName: (data.fullName as string) ?? 'User',
          workStartTime: (data.workStartTime as Date | null) ?? null,
          workEndTime: (data.workEndTime as Date | null) ?? null,
          usualWakeTime: (data.usualWakeTime as Date | null) ?? null,
          usualSleepTime: (data.usualSleepTime as Date | null) ?? null,
          age: (data.age as number | null) ?? null,
          gender: (data.gender as string | null) ?? null,
          heightCm: (data.heightCm as number | null) ?? null,
          weightKg: (data.weightKg as number | null) ?? null,
          occupation: (data.occupation as string | null) ?? null,
          mainGoal: (data.mainGoal as string | null) ?? null,
          activityLevel: (data.activityLevel as string | null) ?? null,
          dietaryPreference: (data.dietaryPreference as string | null) ?? null,
          healthNotes: (data.healthNotes as string | null) ?? null,
          timezone: (data.timezone as string) ?? 'Asia/Ho_Chi_Minh',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(profile.userId, profile);
        return Promise.resolve(profile);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { userId: string };
          data: Partial<MockProfile>;
        }) => {
          const existing = Array.from(rows.values()).find((p) => p.userId === where.userId);
          if (!existing) throw new Error('not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          rows.set(existing.userId, updated);
          return Promise.resolve(updated);
        },
      ),
    },
  };
}

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    service = new ProfileService(makePrisma() as never);
  });

  it('returns exists=false when no profile yet', async () => {
    const r = await service.get('user-A');
    expect(r.exists).toBe(false);
    expect(r.profile).toBeNull();
  });

  it('upsert creates then updates the same row', async () => {
    const a = await service.upsert('user-A', { fullName: 'Alice' });
    expect(a.created).toBe(true);
    expect(a.profile.fullName).toBe('Alice');

    const b = await service.upsert('user-A', { fullName: 'Alice 2', mainGoal: 'HEALTHY' });
    expect(b.created).toBe(false);
    expect(b.profile.fullName).toBe('Alice 2');
    expect(b.profile.mainGoal).toBe('HEALTHY');
  });

  it('converts HH:mm into a UTC Date and back to HH:mm in the response', async () => {
    const r = await service.upsert('user-A', { fullName: 'Bob', workStartTime: '08:30' });
    expect(r.profile.workStartTime).toBe('08:30');
  });
});
