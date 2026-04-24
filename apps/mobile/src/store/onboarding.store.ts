import { create } from 'zustand';

/**
 * In-memory state for the 5-step onboarding flow. Each step writes its local
 * answers via `patch()`; the final Finance step calls PUT /profile + creates
 * default wallets and then resets the draft.
 *
 * We deliberately don't persist to storage — if the user kills the app
 * mid-onboarding we'd rather they see a clean slate than stale half-answers.
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

const DEFAULT: OnboardingDraft = {
  locale: 'vi',
  fullName: '',
  age: '',
  gender: '',
  heightCm: '',
  weightKg: '',
  occupation: '',
  mainGoal: '',
  activityLevel: '',
  dietaryPreference: '',
  healthNotes: '',
  workStartTime: '09:00',
  workEndTime: '18:00',
  usualWakeTime: '06:30',
  usualSleepTime: '23:00',
  timezone: 'Asia/Ho_Chi_Minh',
  monthlySalary: '',
  salaryDay: '',
  currency: 'VND',
  createCashWallet: true,
  createBankWallet: true,
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
