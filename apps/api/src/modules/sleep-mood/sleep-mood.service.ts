import { Injectable } from '@nestjs/common';
import type { MoodLog, SleepLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface SleepRow {
  id: string;
  sleepAt: string;
  wakeAt: string;
  durationMinutes: number;
  quality: 'BAD' | 'OK' | 'GOOD' | null;
  note: string | null;
  createdAt: string;
}

export interface MoodRow {
  id: string;
  mood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';
  energy: 'LOW' | 'MEDIUM' | 'HIGH';
  loggedAt: string;
  note: string | null;
  createdAt: string;
}

export interface CreateSleepInput {
  sleepAtIso: string;
  wakeAtIso: string;
  quality?: 'BAD' | 'OK' | 'GOOD' | null;
  note?: string | null;
}

export interface CreateMoodInput {
  mood: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';
  energy: 'LOW' | 'MEDIUM' | 'HIGH';
  loggedAtIso: string;
  note?: string | null;
}

@Injectable()
export class SleepMoodService {
  constructor(private readonly prisma: PrismaService) {}

  async latestSleep(userId: string): Promise<SleepRow | null> {
    const row = await this.prisma.sleepLog.findFirst({
      where: { userId },
      orderBy: { sleepAt: 'desc' },
    });
    return row ? toSleep(row) : null;
  }

  async latestMood(userId: string): Promise<MoodRow | null> {
    const row = await this.prisma.moodLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });
    return row ? toMood(row) : null;
  }

  async listSleep(userId: string, range: RangeName | null) {
    const where: Record<string, unknown> = { userId };
    if (range) {
      const { start, end } = rangeFor(range);
      where.sleepAt = { gte: start, lt: end };
    }
    const rows = await this.prisma.sleepLog.findMany({
      where,
      orderBy: { sleepAt: 'desc' },
      take: 100,
    });
    return { range, total: rows.length, rows: rows.map(toSleep) };
  }

  async listMood(userId: string, range: RangeName | null) {
    const where: Record<string, unknown> = { userId };
    if (range) {
      const { start, end } = rangeFor(range);
      where.loggedAt = { gte: start, lt: end };
    }
    const rows = await this.prisma.moodLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });
    return { range, total: rows.length, rows: rows.map(toMood) };
  }

  async createSleep(userId: string, input: CreateSleepInput): Promise<SleepRow> {
    const sleepAt = new Date(input.sleepAtIso);
    const wakeAt = new Date(input.wakeAtIso);
    const durationMinutes = Math.round((wakeAt.getTime() - sleepAt.getTime()) / 60_000);
    const row = await this.prisma.sleepLog.create({
      data: {
        userId,
        sleepAt,
        wakeAt,
        durationMinutes,
        quality: input.quality ?? null,
        note: input.note?.trim() || null,
      },
    });
    return toSleep(row);
  }

  async createMood(userId: string, input: CreateMoodInput): Promise<MoodRow> {
    const row = await this.prisma.moodLog.create({
      data: {
        userId,
        mood: input.mood,
        energy: input.energy,
        loggedAt: new Date(input.loggedAtIso),
        note: input.note?.trim() || null,
      },
    });
    return toMood(row);
  }
}

function toSleep(s: SleepLog): SleepRow {
  return {
    id: s.id,
    sleepAt: s.sleepAt.toISOString(),
    wakeAt: s.wakeAt.toISOString(),
    durationMinutes: s.durationMinutes,
    quality: s.quality ?? null,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
  };
}

function toMood(m: MoodLog): MoodRow {
  return {
    id: m.id,
    mood: m.mood,
    energy: m.energy,
    loggedAt: m.loggedAt.toISOString(),
    note: m.note,
    createdAt: m.createdAt.toISOString(),
  };
}
