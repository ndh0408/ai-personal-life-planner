import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Profile: undefined;
  Goal: undefined;
  Schedule: undefined;
  Finance: undefined;
};

/**
 * Main bottom-tab set. Per product spec this iteration:
 *   Dashboard | Today | Finance | Assistant | Profile
 *
 * Tasks/Habits/Meals still exist as secondary screens reachable from
 * Dashboard/Today cards (not as tabs).
 */
export type MainTabsParamList = {
  Dashboard: undefined;
  Today: undefined;
  Finance: undefined;
  Assistant: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  // modals & detail screens
  CreateTask: { taskId?: string } | undefined;
  CreateHabit: { habitId?: string } | undefined;
  ScheduleDetail: { date: string };
  SleepMoodCheckin: undefined;
  Reports: undefined;
  WeeklyReport: undefined;
  DailyReview: undefined;
  MonthlyFinanceReport: undefined;
  GoalProgressReport: undefined;
  Tasks: undefined;
  Habits: undefined;
  Meals: undefined;
  Health: undefined;
  HealthMetric: undefined;
  Wallets: undefined;
  AddWallet: undefined;
  Income: undefined;
  AddIncome: undefined;
  Expense: undefined;
  AddExpense: undefined;
  Budget: undefined;
  AddBudget: undefined;
  Debt: undefined;
  AddDebt: undefined;
  SavingGoals: undefined;
  AddSavingGoal: undefined;
  PersonalGoals: undefined;
  CreateGoal: { goalId?: string } | undefined;
  GoalDetail: { goalId: string };
  Settings: undefined;
  LanguageSettings: undefined;
  AIChat: undefined;
  AiProviderSettings: undefined;
  AISetup: undefined;
  AddAiProvider: undefined;
  EditAiProvider: { providerId: string };
  PrivacySettings: undefined;
  PermissionCenter: undefined;
  DataUsageSummary: undefined;
  PersonalizationConsent: undefined;
  ClearAIMemory: undefined;
  RecommendationEvidence: { recommendationId: string };
  CommunicationSettings: undefined;
  ConnectedAccounts: undefined;
  EmailAssistant: undefined;
  FollowUpReminders: undefined;
  AddMessageReminder: undefined;
  AICompanionMemory: undefined;
  VoiceCompanion: undefined;
  QuickCapture: undefined;
  SuggestedActionsReview: undefined;
  MealQuickLog: undefined;
  SleepQuickLog: undefined;
  MoodQuickLog: undefined;
  SmartCheckinSettings: undefined;
  HealthIntegrationSettings: undefined;
  ContextInferences: undefined;
  WidgetSettings: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> = NativeStackScreenProps<
  OnboardingStackParamList,
  T
>;
export type MainTabsScreenProps<T extends keyof MainTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
