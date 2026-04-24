import { AiCompletionRequest, AiCompletionResponse, AiProvider } from './ai-provider.interface';

/**
 * Deterministic fake provider for dev + tests.
 *
 * Behavior:
 * - For prompts containing the marker `[task:generate-schedule]` it returns a
 *   syntactically-valid daily plan JSON.
 * - For `[task:reschedule]` → reschedule preview JSON.
 * - For `[task:meal-suggestion]` → 4 meal suggestions.
 * - For `[task:weekly-insight]` → insight JSON.
 * - For `[task:chat]` → a concise chat answer.
 * - For anything else → echoes the prompt prefix.
 *
 * Tests can override per-instance behavior via `setNextResponse(text)`,
 * `setBroken(true)` (returns invalid JSON once) or `setHang(ms)` (sleeps so
 * the orchestrator's timeout fires).
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private nextResponses: string[] = [];
  private broken = false;
  private hangMs = 0;

  setNextResponse(text: string) {
    this.nextResponses.push(text);
  }
  setBroken(value: boolean) {
    this.broken = value;
  }
  setHang(ms: number) {
    this.hangMs = ms;
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (this.hangMs > 0) {
      await new Promise((r) => setTimeout(r, this.hangMs));
    }

    let text: string;
    if (this.nextResponses.length > 0) {
      text = this.nextResponses.shift()!;
    } else if (this.broken) {
      this.broken = false;
      text = '{ this is not valid json';
    } else {
      // Markers can live in either system or prompt — check both.
      text = this.synthesize(`${req.system ?? ''}\n${req.prompt}`);
    }

    return {
      text,
      usage: { inputTokens: req.prompt.length, outputTokens: text.length },
      provider: this.name,
      model: 'mock-1',
    };
  }

  private synthesize(prompt: string): string {
    if (prompt.includes('[task:generate-schedule]')) {
      return JSON.stringify({
        wakeUpTime: '06:30',
        sleepTime: '23:00',
        summary: 'Balanced day with deep work in the morning and lighter afternoon.',
        schedule: [
          {
            title: 'Wake up + stretch',
            description: '5 min mobility',
            startTime: '06:30',
            endTime: '06:45',
            type: 'REST',
            priority: 'LOW',
            reason: 'Profile usual wake time',
          },
          {
            title: 'Breakfast',
            description: 'High-protein',
            startTime: '07:00',
            endTime: '07:30',
            type: 'MEAL',
            priority: 'MEDIUM',
            reason: 'Dietary preference: high-protein',
          },
          {
            title: 'Deep work block',
            description: 'No meetings, focus on top task',
            startTime: '09:00',
            endTime: '11:30',
            type: 'WORK',
            priority: 'HIGH',
            reason: 'Highest energy slot per profile',
          },
          {
            title: 'Lunch + walk',
            description: '',
            startTime: '12:00',
            endTime: '13:00',
            type: 'MEAL',
            priority: 'MEDIUM',
            reason: 'Recovery + activity',
          },
          {
            title: 'Wind-down',
            description: 'Reading',
            startTime: '22:00',
            endTime: '22:45',
            type: 'REST',
            priority: 'LOW',
            reason: 'Sleep hygiene',
          },
        ],
        warnings: [],
        tips: ['Keep phone out of bedroom for better sleep.'],
      });
    }

    if (prompt.includes('[task:reschedule]')) {
      return JSON.stringify({
        summary: 'Compressed afternoon to absorb the 30-minute delay.',
        kept: [{ id: 'item-1', reason: 'Marked must-keep' }],
        shortened: [{ id: 'item-3', minutesRemoved: 15, reason: 'Lower priority block' }],
        removed: [{ id: 'item-5', reason: 'Lowest priority, can move tomorrow' }],
        warnings: [],
      });
    }

    if (prompt.includes('[task:meal-suggestion]')) {
      return JSON.stringify({
        breakfast: {
          title: 'Oats + eggs + banana',
          ingredients: ['oats 60g', 'eggs x2', 'banana x1'],
          estimatedCalories: 520,
          prepTimeMinutes: 10,
          reason: 'Quick, balanced macros',
        },
        lunch: {
          title: 'Chicken + brown rice + broccoli',
          ingredients: ['chicken 180g', 'brown rice 120g', 'broccoli 150g'],
          estimatedCalories: 720,
          prepTimeMinutes: 25,
          reason: 'High-protein per goal',
        },
        dinner: {
          title: 'Chicken + roasted veggies',
          ingredients: ['chicken 150g', 'mixed veggies 200g'],
          estimatedCalories: 580,
          prepTimeMinutes: 25,
          reason: 'Light carbs after 7pm',
        },
        snack: {
          title: 'Greek yogurt + nuts',
          ingredients: ['Greek yogurt 200g', 'mixed nuts 25g'],
          estimatedCalories: 320,
          prepTimeMinutes: 2,
          reason: 'Protein top-up',
        },
        notes: 'Fits ~2200 kcal target.',
      });
    }

    if (prompt.includes('[task:weekly-insight]')) {
      return JSON.stringify({
        summary: 'Solid week overall — sleep dipped mid-week but recovered.',
        goodPoints: ['5 of 7 workouts logged', 'Mood trended positive'],
        improvementPoints: ['Two late-night sleep entries', 'Skipped Wednesday meditation'],
        nextWeekSuggestions: [
          'Set 22:30 phone-down reminder',
          'Move workout to morning on Wed when meetings stack up',
        ],
      });
    }

    if (prompt.includes('[task:finance-analysis]')) {
      return JSON.stringify({
        totalIncome: 29500000,
        totalExpense: 9505000,
        remainingMoney: 19995000,
        budgetWarnings: [
          {
            category: 'shopping',
            usagePercent: 240,
            message: 'Shopping spending is 2.4× the monthly cap.',
          },
        ],
        spendingPatterns: [
          'Weekday food spending dominated by eat-out lunches.',
          'One impulse purchase in "shopping" drove most of the overrun.',
        ],
        savingSuggestions: [
          'Move 10% of salary to a separate savings account on pay day.',
          'Pause non-essential shopping for the rest of the month.',
        ],
        debtSuggestions: [
          'Keep the 1m VND/month laptop-loan payment; you are on track.',
        ],
        salaryAllocationSuggestion: {
          needPercent: 55,
          wantPercent: 20,
          savePercent: 25,
          comment: 'Leaner wants, heavier savings while the emergency fund is below 3 months.',
        },
        usefulAdvice: [
          'Log expenses daily — it usually trims 5-10% without changing lifestyle.',
          'For any investment question, consult a licensed financial advisor.',
        ],
      });
    }

    if (prompt.includes('[task:daily-review]')) {
      return JSON.stringify({
        todaySummary:
          'Productive morning, lighter afternoon. Sleep was a bit short but mood stayed positive.',
        wins: ['Completed deep-work block', 'Logged 8/8 glasses of water'],
        issues: ['Skipped the planned home-cooked dinner', 'Went to bed after midnight'],
        suggestionsForTomorrow: [
          'Prep dinner ingredients before 6 PM.',
          'Phone down by 22:30 to hit the sleep target.',
        ],
        healthAdvice: 'Short sleep two nights in a row — try a 15-minute earlier bedtime tonight.',
        financeAdvice: 'You are on track this week; log any remaining coffee-shop receipts before bed.',
        productivityAdvice: 'Pick the single most important task for tomorrow and schedule it 9-10 AM.',
      });
    }

    if (prompt.includes('[task:chat]')) {
      return JSON.stringify({
        answer:
          'Try blocking 30 minutes after lunch for a short walk — it usually rescues your afternoon energy.',
        suggestedActions: [
          { type: 'add_schedule_item', title: 'Walk', startTime: '13:00', endTime: '13:20' },
        ],
      });
    }

    return JSON.stringify({ echo: prompt.slice(0, 200) });
  }
}
