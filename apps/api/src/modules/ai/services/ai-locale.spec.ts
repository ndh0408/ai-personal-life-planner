import { buildGenerateScheduleSystem } from '../prompts/generate-schedule.prompt';
import { buildMealSystem } from '../prompts/meal-suggestion.prompt';
import { buildChatSystem } from '../prompts/chat.prompt';
import { buildRescheduleSystem } from '../prompts/reschedule.prompt';
import { buildWeeklyInsightSystem } from '../prompts/weekly-insight.prompt';
import { buildDailyReviewSystem } from '../prompts/daily-review.prompt';
import { buildFinanceAnalysisSystem } from '../prompts/finance-analysis.prompt';
import { buildLanguageDirective } from '../prompts/system';

describe('AI locale directives', () => {
  it('default prompt asks for Vietnamese', () => {
    const system = buildGenerateScheduleSystem();
    expect(system).toContain('Vietnamese');
    expect(system).not.toContain('MUST be in English');
  });

  it('explicit locale="vi" keeps Vietnamese', () => {
    expect(buildGenerateScheduleSystem('vi')).toContain('Vietnamese');
    expect(buildMealSystem('vi')).toContain('Vietnamese');
    expect(buildChatSystem('vi')).toContain('Vietnamese');
    expect(buildRescheduleSystem('vi')).toContain('Vietnamese');
    expect(buildWeeklyInsightSystem('vi')).toContain('Vietnamese');
    expect(buildDailyReviewSystem('vi')).toContain('Vietnamese');
    expect(buildFinanceAnalysisSystem('vi')).toContain('Vietnamese');
  });

  it('locale="en" switches every system prompt to English', () => {
    expect(buildGenerateScheduleSystem('en')).toContain('MUST be in English');
    expect(buildMealSystem('en')).toContain('MUST be in English');
    expect(buildChatSystem('en')).toContain('MUST be in English');
    expect(buildRescheduleSystem('en')).toContain('MUST be in English');
    expect(buildWeeklyInsightSystem('en')).toContain('MUST be in English');
    expect(buildDailyReviewSystem('en')).toContain('MUST be in English');
    expect(buildFinanceAnalysisSystem('en')).toContain('MUST be in English');
  });

  it('keeps enum values in English regardless of locale', () => {
    for (const locale of ['vi', 'en'] as const) {
      const directive = buildLanguageDirective(locale);
      expect(directive).toContain('SLEEP');
      expect(directive).toContain('MEAL');
    }
  });

  it('system prompt still contains JSON-only rule', () => {
    expect(buildGenerateScheduleSystem('vi')).toContain('raw JSON');
    expect(buildGenerateScheduleSystem('en')).toContain('raw JSON');
  });
});
