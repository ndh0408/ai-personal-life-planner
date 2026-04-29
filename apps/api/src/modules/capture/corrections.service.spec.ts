import { CorrectionsService } from './corrections.service';
import type { PrismaService } from '../../prisma/prisma.service';

interface CorrectionRow {
  id: string;
  userId: string;
  rawText: string;
  originalKind: string | null;
  correctedKind: string | null;
  originalPayload: Record<string, unknown> | null;
  correctedPayload: Record<string, unknown> | null;
  createdAt: Date;
}

function makeService(opts: { rows?: CorrectionRow[] } = {}) {
  const rows = opts.rows ?? [];
  const prisma = {
    captureCorrection: {
      findMany: jest.fn(async ({ take }: { take: number }) =>
        // Sort first, then slice — the real Prisma query orders before take.
        [...rows]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take),
      ),
      create: jest.fn(async ({ data }: { data: Partial<CorrectionRow> }) => {
        const row: CorrectionRow = {
          id: `c${rows.length + 1}`,
          userId: data.userId ?? 'u1',
          rawText: data.rawText ?? '',
          originalKind: data.originalKind ?? null,
          correctedKind: data.correctedKind ?? null,
          originalPayload: (data.originalPayload as CorrectionRow['originalPayload']) ?? null,
          correctedPayload: (data.correctedPayload as CorrectionRow['correctedPayload']) ?? null,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
    },
    quickCapture: {
      update: jest.fn(async () => undefined),
    },
  } as unknown as PrismaService;
  return { svc: new CorrectionsService(prisma), prisma, rows };
}

describe('CorrectionsService', () => {
  it('recentForUser returns at most `limit` rows newest-first', async () => {
    const now = Date.now();
    const rows: CorrectionRow[] = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      userId: 'u1',
      rawText: `text ${i}`,
      originalKind: 'MEAL',
      correctedKind: 'EXPENSE',
      originalPayload: null,
      correctedPayload: null,
      createdAt: new Date(now + i * 1000),
    }));
    const { svc } = makeService({ rows });
    const out = await svc.recentForUser('u1', 5);
    expect(out).toHaveLength(5);
    expect(out[0].rawText).toBe('text 7'); // newest
  });

  it('record() inserts a CaptureCorrection and bumps QuickCapture.correctionCount', async () => {
    const { svc, prisma, rows } = makeService();
    await svc.record({
      userId: 'u1',
      quickCaptureId: 'qc1',
      rawText: 'trà sữa 60k',
      originalSource: 'RULE',
      originalKind: 'MEAL',
      originalConfidence: 0.7,
      originalPayload: { title: 'trà sữa' },
      correctedKind: 'EXPENSE',
      correctedPayload: { title: 'trà sữa', amount: 60_000 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].correctedKind).toBe('EXPENSE');
    expect(prisma.quickCapture.update).toHaveBeenCalledWith({
      where: { id: 'qc1' },
      data: { correctionCount: { increment: 1 } },
    });
  });
});
