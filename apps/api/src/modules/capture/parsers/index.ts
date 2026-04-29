import type { ParseContext, ParseHit } from './types';
import { ExpenseParser } from './expense.parser';
import { IncomeParser } from './income.parser';
import { MealParser } from './meal.parser';
import { TaskParser } from './task.parser';
import { SleepParser } from './sleep.parser';
import { MoodParser } from './mood.parser';

const PARSERS = [
  // Income runs before Expense — "lương 15tr" must beat "spend 15tr".
  new IncomeParser(),
  new ExpenseParser(),
  new MealParser(),
  new TaskParser(),
  new SleepParser(),
  new MoodParser(),
];

/**
 * Run every rule parser, return the highest-confidence hit. Null if all reject.
 * Ties broken by parser order — Income > Expense > Meal > Task > Sleep > Mood.
 */
export function runRuleParsers(text: string, ctx: ParseContext): ParseHit | null {
  const hits = runRuleParsersAll(text, ctx);
  return hits[0] ?? null;
}

/**
 * Run every rule parser and return all hits sorted by confidence descending.
 * Used by capture.service to populate `alternatives` on the parse response —
 * when the top pick is uncertain, surfacing "or maybe TASK / MEAL?" lets the
 * user one-tap-switch instead of editing the kind manually.
 */
export function runRuleParsersAll(text: string, ctx: ParseContext): ParseHit[] {
  const hits: ParseHit[] = [];
  for (const p of PARSERS) {
    const hit = p.match(text, ctx);
    if (hit) hits.push(hit);
  }
  return hits.sort((a, b) => b.confidence - a.confidence);
}

export type { ParseContext, ParseHit, RuleParser } from './types';
