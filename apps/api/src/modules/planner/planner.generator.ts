/**
 * Rule-based DailyPlan fallback. Used only when the AI path is unavailable
 * (no key, privacy off, network/timeout). Even here we try not to be a fixed
 * template — meals anchor around the user's actual wake/sleep window, and
 * supportive items react to mainGoals.
 */
import type { Task, UserProfile } from '@prisma/client';

export interface DraftItem {
  title: string;
  type: 'TASK' | 'MEAL' | 'REST' | 'WORK' | 'PERSONAL' | 'HEALTH' | 'FINANCE' | 'CUSTOM';
  startAt: Date | null;
  endAt: Date | null;
  sortOrder: number;
}

interface Profile {
  usualWakeTime?: string | null;
  usualSleepTime?: string | null;
  mainGoals?: unknown;
}

const HCM_OFFSET_MIN = 7 * 60;
function offsetMin(tz: string): number {
  return tz === 'Asia/Ho_Chi_Minh' ? HCM_OFFSET_MIN : 0;
}

function isoAt(tz: string, y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m, d, h, min) - offsetMin(tz) * 60_000);
}

function localParts(now: Date, tz: string) {
  const local = new Date(now.getTime() + offsetMin(tz) * 60_000);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
  };
}

function parseHHMM(s: string | null | undefined, fallbackH: number, fallbackM: number) {
  if (!s) return { h: fallbackH, m: fallbackM };
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return { h: fallbackH, m: fallbackM };
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return { h, m: min };
}

function parseGoals(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  return [];
}

/**
 * Anchor breakfast at wake+1h, dinner at sleep-2.5h, lunch midway.
 * That way someone who wakes at 9 and sleeps at 1 doesn't get a 7am breakfast.
 */
function mealAnchors(wake: { h: number; m: number }, sleep: { h: number; m: number }): Array<{
  title: string;
  h: number;
  m: number;
}> {
  const wakeMin = wake.h * 60 + wake.m;
  let sleepMin = sleep.h * 60 + sleep.m;
  if (sleepMin <= wakeMin) sleepMin += 24 * 60; // crosses midnight

  const breakfastMin = wakeMin + 60;
  const dinnerMin = sleepMin - 150; // 2h30 before sleep
  const lunchMin = Math.round((breakfastMin + dinnerMin) / 2);

  const toHM = (mm: number) => {
    const wrapped = ((mm % (24 * 60)) + 24 * 60) % (24 * 60);
    return { h: Math.floor(wrapped / 60), m: wrapped % 60 };
  };

  const b = toHM(breakfastMin);
  const l = toHM(lunchMin);
  const d = toHM(dinnerMin);

  return [
    { title: 'Bữa sáng', h: b.h, m: b.m },
    { title: 'Bữa trưa', h: l.h, m: l.m },
    { title: 'Bữa tối', h: d.h, m: d.m },
  ];
}

export function generatePlanItems(
  tasks: Task[],
  profile: Profile | UserProfile | null,
  now = new Date(),
  tz = 'Asia/Ho_Chi_Minh',
): DraftItem[] {
  const { y, m, d } = localParts(now, tz);
  const wake = parseHHMM(profile?.usualWakeTime ?? null, 6, 30);
  const sleep = parseHHMM(profile?.usualSleepTime ?? null, 23, 0);
  const goals = parseGoals(profile?.mainGoals);

  const drafts: DraftItem[] = [];
  let order = 1;

  for (const meal of mealAnchors(wake, sleep)) {
    drafts.push({
      title: meal.title,
      type: 'MEAL',
      startAt: isoAt(tz, y, m, d, meal.h, meal.m),
      endAt: isoAt(tz, y, m, d, meal.h, meal.m + 30),
      sortOrder: order++,
    });
  }

  // Tasks slotted in 60-min blocks starting 90min after breakfast.
  const wakeMin = wake.h * 60 + wake.m;
  const firstSlot = wakeMin + 150; // breakfast(+60) + 90min margin
  const candidates = tasks
    .filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
    .filter((t) => {
      if (!t.dueAt) return true;
      const dayStart = isoAt(tz, y, m, d, 0, 0);
      const dayEnd = isoAt(tz, y, m, d + 1, 0, 0);
      return t.dueAt >= dayStart && t.dueAt < dayEnd;
    })
    .sort((a, b) => {
      const p = priorityRank(b.priority) - priorityRank(a.priority);
      if (p !== 0) return p;
      const ad = a.dueAt?.getTime() ?? Infinity;
      const bd = b.dueAt?.getTime() ?? Infinity;
      return ad - bd;
    })
    .slice(0, 5);

  candidates.forEach((task, i) => {
    const slot = firstSlot + i * 90;
    if (slot >= 22 * 60) return;
    const sh = Math.floor(slot / 60) % 24;
    const sm = slot % 60;
    drafts.push({
      title: task.title,
      type: 'TASK',
      startAt: isoAt(tz, y, m, d, sh, sm),
      endAt: isoAt(tz, y, m, d, sh, sm + 60),
      sortOrder: order++,
    });
  });

  // Supportive items react to mainGoals — not the same set for everyone.
  const sleepHasContent = sleep.h !== 0 || sleep.m !== 0;
  if (goals.includes('sleep') || goals.includes('balance')) {
    if (sleepHasContent) {
      drafts.push({
        title: `Wind-down trước ${pad(sleep.h)}:${pad(sleep.m)}`,
        type: 'REST',
        startAt: isoAt(tz, y, m, d, (sleep.h + 23) % 24, sleep.m),
        endAt: isoAt(tz, y, m, d, sleep.h, sleep.m),
        sortOrder: order++,
      });
    }
  }
  if (goals.includes('habit') || goals.includes('balance')) {
    drafts.push({
      title: 'Đi bộ ngắn 15 phút',
      type: 'HEALTH',
      startAt: isoAt(tz, y, m, d, 17, 30),
      endAt: isoAt(tz, y, m, d, 17, 45),
      sortOrder: order++,
    });
  }
  if (goals.includes('money')) {
    drafts.push({
      title: 'Xem lại chi tiêu hôm nay',
      type: 'FINANCE',
      startAt: isoAt(tz, y, m, d, 21, 0),
      endAt: isoAt(tz, y, m, d, 21, 10),
      sortOrder: order++,
    });
  }

  return drafts
    .sort((a, b) => {
      const at = a.startAt?.getTime() ?? Infinity;
      const bt = b.startAt?.getTime() ?? Infinity;
      return at - bt;
    })
    .map((it, i) => ({ ...it, sortOrder: i + 1 }));
}

function priorityRank(p: 'LOW' | 'MEDIUM' | 'HIGH'): number {
  return p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
