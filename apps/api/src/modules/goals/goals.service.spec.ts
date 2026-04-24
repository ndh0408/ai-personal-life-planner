import { GoalsService } from './goals.service';
import { GoalCategory, PersonalGoalStatus, Prisma, Priority } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  const api = {
    personalGoal: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          Array.from(rows.values()).filter((g) => (g as { userId: string }).userId === where.userId),
        ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.PersonalGoalUncheckedCreateInput }) => {
        const row = {
          id: `g-${rows.size + 1}`,
          ...data,
          priority: data.priority ?? Priority.MEDIUM,
          status: data.status ?? PersonalGoalStatus.ACTIVE,
          milestones: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.get(where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        rows.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
  };
  return { prisma: api, rows };
}

describe('GoalsService', () => {
  let svc: GoalsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new GoalsService(ctx.prisma as never);
  });

  it('create: defaults priority=MEDIUM, status=ACTIVE', async () => {
    const g = await svc.create('u1', {
      title: 'Run a half marathon',
      category: GoalCategory.HEALTH,
    });
    expect(g.priority).toBe(Priority.MEDIUM);
    expect(g.status).toBe(PersonalGoalStatus.ACTIVE);
  });

  it('enforces ownership on getById', async () => {
    const g = await svc.create('u1', { title: 'x', category: GoalCategory.OTHER });
    await expect(svc.getById('u2', g.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for unknown', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: marks COMPLETED and leaves other fields alone', async () => {
    const g = await svc.create('u1', {
      title: 'Save 100m',
      category: GoalCategory.FINANCE,
    });
    const after = await svc.update('u1', g.id, { status: PersonalGoalStatus.COMPLETED });
    expect(after.status).toBe(PersonalGoalStatus.COMPLETED);
    expect(after.title).toBe('Save 100m');
  });

  it('list: scopes to caller', async () => {
    await svc.create('u1', { title: 'mine', category: GoalCategory.PERSONAL });
    await svc.create('u2', { title: 'other', category: GoalCategory.PERSONAL });
    const mine = await svc.list('u1');
    expect(mine).toHaveLength(1);
  });
});
