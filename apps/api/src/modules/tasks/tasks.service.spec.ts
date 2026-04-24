import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

type MockTask = {
  id: string;
  userId: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string | null;
  dueDate: Date | null;
  description: string | null;
  estimatedMinutes: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makePrisma() {
  const tasks = new Map<string, MockTask>();
  let counter = 0;

  const prisma = {
    task: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(tasks.get(where.id) ?? null),
      ),
      findMany: jest.fn((args: { where: { userId: string } } = { where: { userId: '' } }) =>
        Promise.resolve(
          Array.from(tasks.values()).filter((t) => t.userId === args.where.userId),
        ),
      ),
      count: jest.fn((args: { where: { userId: string } } = { where: { userId: '' } }) =>
        Promise.resolve(
          Array.from(tasks.values()).filter((t) => t.userId === args.where.userId).length,
        ),
      ),
      create: jest.fn(({ data }: { data: Partial<MockTask> & { userId: string; title: string } }) => {
        counter += 1;
        const task: MockTask = {
          id: `t-${counter}`,
          userId: data.userId,
          title: data.title,
          status: 'TODO',
          priority: data.priority ?? 'MEDIUM',
          category: data.category ?? null,
          dueDate: data.dueDate ?? null,
          description: data.description ?? null,
          estimatedMinutes: data.estimatedMinutes ?? null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        tasks.set(task.id, task);
        return Promise.resolve(task);
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockTask> }) => {
        const existing = tasks.get(where.id);
        if (!existing) throw new Error('not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        tasks.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        tasks.delete(where.id);
        return Promise.resolve(null);
      }),
    },
    $transaction: jest.fn((promises: Promise<unknown>[]) => Promise.all(promises)),
  };
  return prisma;
}

describe('TasksService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TasksService;

  beforeEach(() => {
    prisma = makePrisma();
    // Cast: the service only touches the methods we mocked.
    service = new TasksService(prisma as never);
  });

  it('creates a task scoped to the caller', async () => {
    const task = await service.create('user-A', {
      title: 'Buy milk',
      priority: 'HIGH',
      category: 'errand',
    });
    expect(task.userId).toBe('user-A');
    expect(task.title).toBe('Buy milk');
    expect(task.status).toBe('TODO');
  });

  it('marks a task COMPLETED and stamps completedAt', async () => {
    const created = await service.create('user-A', { title: 'Run', priority: 'LOW' });
    const updated = await service.patchStatus('user-A', created.id, { status: 'COMPLETED' });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.completedAt).toBeInstanceOf(Date);
  });

  it('clears completedAt when moving back to a non-COMPLETED status', async () => {
    const created = await service.create('user-A', { title: 'Run', priority: 'LOW' });
    await service.patchStatus('user-A', created.id, { status: 'COMPLETED' });
    const reopened = await service.patchStatus('user-A', created.id, { status: 'IN_PROGRESS' });
    expect(reopened.completedAt).toBeNull();
  });

  it('rejects access to a task owned by another user (IDOR guard)', async () => {
    const created = await service.create('user-A', { title: 'Mine', priority: 'LOW' });
    await expect(service.getById('user-B', created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete('user-B', created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.patchStatus('user-B', created.id, { status: 'COMPLETED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s on unknown task id', async () => {
    await expect(service.getById('user-A', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
