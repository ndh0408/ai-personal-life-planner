/**
 * Rule-based DailyPlan generator.
 *
 * Builds a sensible day from:
 *  • the user's profile (usual wake / sleep times) — anchors the bookends
 *  • TODO/IN_PROGRESS tasks due today (each becomes a TASK item, slotted
 *    around the user's working window)
 *  • three meal slots (breakfast / lunch / dinner) at sensible times
 *
 * Output is a `DraftItem[]` ready to be persisted by PlannerService. The
 * AI-augmented generator (round 7+) will share the same shape so the
 * service stays a thin orchestrator.
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
}

const HCM_OFFSET_MIN = 7 * 60;
function offsetMin(tz: string): number {
  return tz === 'Asia/Ho_Chi_Minh' ? HCM_OFFSET_MIN : 0;
}

/** Build a Date for the given y/m/d/h/m in the user's tz. */
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

export function generatePlanItems(
  tasks: Task[],
  profile: Profile | UserProfile | null,
  now = new Date(),
  tz = 'Asia/Ho_Chi_Minh',
): DraftItem[] {
  const { y, m, d } = localParts(now, tz);
  const wake = parseHHMM(profile?.usualWakeTime ?? null, 6, 30);
  const sleep = parseHHMM(profile?.usualSleepTime ?? null, 23, 0);

  const drafts: DraftItem[] = [];
  let order = 1;

  // Meals — three anchor times in user-local terms.
  const mealAnchors: Array<{ title: string; h: number; m: number }> = [
    { title: 'Bữa sáng', h: Math.max(wake.h + 1, 7), m: 0 },
    { title: 'Bữa trưa', h: 12, m: 0 },
    { title: 'Bữa tối', h: 19, m: 0 },
  ];
  for (const meal of mealAnchors) {
    drafts.push({
      title: meal.title,
      type: 'MEAL',
      startAt: isoAt(tz, y, m, d, meal.h, meal.m),
      endAt: isoAt(tz, y, m, d, meal.h, meal.m + 30),
      sortOrder: order++,
    });
  }

  // Tasks — slot uncompleted tasks due today (or with no dueAt) inside the
  // working window between breakfast and dinner. Cap at 5 to avoid overwhelm.
  const dayStart = isoAt(tz, y, m, d, 0, 0);
  const dayEnd = isoAt(tz, y, m, d + 1, 0, 0);
  const candidates = tasks
    .filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
    .filter((t) => !t.dueAt || (t.dueAt >= dayStart && t.dueAt < dayEnd))
    .sort((a, b) => {
      // High priority first; then earliest due
      const p = priorityRank(b.priority) - priorityRank(a.priority);
      if (p !== 0) return p;
      const ad = a.dueAt?.getTime() ?? Infinity;
      const bd = b.dueAt?.getTime() ?? Infinity;
      return ad - bd;
    })
    .slice(0, 5);

  // Assign each task a 1-hour block starting at 09:30 + i*90min.
  candidates.forEach((task, i) => {
    const slot = 9 * 60 + 30 + i * 90; // minutes since midnight, local
    if (slot >= 18 * 60) return; // no slot after 18:00
    const sh = Math.floor(slot / 60);
    const sm = slot % 60;
    drafts.push({
      title: task.title,
      type: 'TASK',
      startAt: isoAt(tz, y, m, d, sh, sm),
      endAt: isoAt(tz, y, m, d, sh, sm + 60),
      sortOrder: order++,
    });
  });

  // Rest before sleep — short walk + winddown
  if (sleep.h >= 21) {
    drafts.push({
      title: 'Đi bộ 20 phút',
      type: 'HEALTH',
      startAt: isoAt(tz, y, m, d, 17, 30),
      endAt: isoAt(tz, y, m, d, 17, 50),
      sortOrder: order++,
    });
    drafts.push({
      title: `Ngủ trước ${String(sleep.h).padStart(2, '0')}:${String(sleep.m).padStart(2, '0')}`,
      type: 'REST',
      startAt: isoAt(tz, y, m, d, sleep.h - 1, sleep.m),
      endAt: isoAt(tz, y, m, d, sleep.h, sleep.m),
      sortOrder: order++,
    });
  }

  return drafts.sort((a, b) => {
    const at = a.startAt?.getTime() ?? Infinity;
    const bt = b.startAt?.getTime() ?? Infinity;
    return at - bt;
  }).map((d, i) => ({ ...d, sortOrder: i + 1 }));
}

function priorityRank(p: 'LOW' | 'MEDIUM' | 'HIGH'): number {
  return p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1;
}
