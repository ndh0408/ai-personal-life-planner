import { create } from 'zustand';
import * as Localization from 'expo-localization';

/**
 * In-memory state for the onboarding flow.
 *
 * Round 21: collapsed from 5 steps to 3 (Welcome → Basics → AI setup).
 * Body-metrics, salary, and detailed schedule are no longer asked
 * upfront — users set those in Profile settings if they want to.
 *
 * The shape of the draft is unchanged so the existing `profileApi.update`
 * call still receives the same DTO; new defaults below cover the
 * dropped fields. Timezone is auto-detected from the device locale.
 */
export type OnboardingDraft = {
  // Welcome
  locale: 'vi' | 'en';
  // Profile
  fullName: string;
  age: string; // kept as string in the form, coerced on submit
  gender: string;
  heightCm: string;
  weightKg: string;
  occupation: string;
  // Goals
  mainGoal:
    | 'LOSE_WEIGHT'
    | 'GAIN_WEIGHT'
    | 'SLEEP_EARLY'
    | 'PRODUCTIVE'
    | 'STUDY'
    | 'HEALTHY'
    | 'BALANCE'
    | 'FINANCIAL_STABILITY'
    | 'CAREER_GROWTH'
    | '';
  activityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | '';
  dietaryPreference: string;
  healthNotes: string;
  // Schedule
  workStartTime: string;
  workEndTime: string;
  usualWakeTime: string;
  usualSleepTime: string;
  timezone: string;
  // Finance
  monthlySalary: string;
  salaryDay: string;
  currency: string;
  createCashWallet: boolean;
  createBankWallet: boolean;
  wantsMonthlyBudget: boolean;
};

/**
 * Best-effort timezone autodetect from the device. Falls back to Asia
 * because the app's primary market is Vietnam. Profile settings still
 * lets the user override.
 */
function detectTimezone(): string {
  try {
    const tz = Localization.getCalendars()[0]?.timeZone;
    if (tz && typeof tz === 'string') return tz;
  } catch {
    // expo-localization not available (e.g. some Jest envs) — fall through.
  }
  return 'Asia/Ho_Chi_Minh';
}

const DEFAULT: OnboardingDraft = {
  locale: 'vi',
  fullName: '',
  // Body-metrics + occupation are no longer asked in onboarding — keep
  // empty defaults so profileApi.update receives `undefined` for them.
  age: '',
  gender: '',
  heightCm: '',
  weightKg: '',
  occupation: '',
  mainGoal: '',
  activityLevel: 'MEDIUM',
  dietaryPreference: '',
  healthNotes: '',
  // Sensible work-day defaults — user can edit in Profile.
  workStartTime: '09:00',
  workEndTime: '18:00',
  usualWakeTime: '06:30',
  usualSleepTime: '23:00',
  timezone: detectTimezone(),
  // Finance fields — no longer asked upfront.
  monthlySalary: '',
  salaryDay: '',
  currency: 'VND',
  // Auto-create the Cash wallet so AddExpense has a default; bank /
  // budget toggles default off (user can add later in Finance).
  createCashWallet: true,
  createBankWallet: false,
  wantsMonthlyBudget: false,
};

type OnboardingState = {
  draft: OnboardingDraft;
  patch: (partial: Partial<OnboardingDraft>) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: DEFAULT,
  patch: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
  reset: () => set({ draft: DEFAULT }),
}));
