import { Injectable } from '@nestjs/common';
import type { MoodLog, SleepLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
