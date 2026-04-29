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
  let best: ParseHit | null = null;
  for (const p of PARSERS) {
    const hit = p.match(text, ctx);
    if (!hit) continue;
    if (!best || hit.confidence > best.confidence) best = hit;
  }
  return best;
}

export type { ParseContext, ParseHit, RuleParser } from './types';
