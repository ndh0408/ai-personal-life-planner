import {
  isWithinQuietHours,
  msUntilQuietHoursEnd,
  respectsTypeSetting,
} from './notification-worker.service';

const fullSetting = {
  wakeReminder: true,
  sleepReminder: true,
  mealReminder: true,
  taskReminder: true,
  habitReminder: true,
  moodCheckinReminder: true,
  financeReminder: true,
  budgetAlert: true,
  goalReminder: true,
  assistantNudge: true,
};

describe('respectsTypeSetting', () => {
  it('honours the per-type flag', () => {
    expect(respectsTypeSetting('reminder.task', fullSetting)).toBe(true);
    expect(
      respectsTypeSetting('reminder.task', { ...fullSetting, taskReminder: false }),
    ).toBe(false);
  });

  it('falls through unmapped types', () => {
    expect(respectsTypeSetting('something.new', fullSetting)).toBe(true);
  });

  it('maps recommendation.* to assistantNudge', () => {
    expect(
      respectsTypeSetting('recommendation.high', { ...fullSetting, assistantNudge: false }),
    ).toBe(false);
  });
});

describe('isWithinQuietHours', () => {
  it('returns false when not configured', () => {
    expect(
      isWithinQuietHours(
        { quietHoursStart: null, quietHoursEnd: null },
        'UTC',
      ),
    ).toBe(false);
  });

  it('returns false when start === end', () => {
    const t = new Date(Date.UTC(1970, 0, 1, 9, 0, 0));
    expect(
      isWithinQuietHours(
        { quietHoursStart: t, quietHoursEnd: t },
        'UTC',
      ),
    ).toBe(false);
  });
});

describe('msUntilQuietHoursEnd', () => {
  it('returns a positive ms value when end is set', () => {
    const end = new Date(Date.UTC(1970, 0, 1, 7, 0, 0));
    const out = msUntilQuietHoursEnd(
      { quietHoursStart: null, quietHoursEnd: end },
      'UTC',
    );
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThanOrEqual(24 * 60 * 60_000);
  });
});
