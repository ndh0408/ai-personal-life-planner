/**
 * Single source of truth for route names + params. Importing from here keeps
 * navigators and screens in sync — adding a new route is one edit.
 */

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  BasicSetup: undefined;
  AISetup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Today: undefined;
  Money: undefined;
  Assistant: undefined;
  Settings: undefined;
};

/**
 * SmartEntry preselects a kind when launched from a quick action chip on
 * Home. `auto` lets the parser decide and is the default when navigating
 * from anywhere else.
 */
export type SmartEntryMode =
  | 'auto'
  | 'EXPENSE'
  | 'INCOME'
  | 'TASK'
  | 'MEAL'
  | 'SLEEP'
  | 'MOOD';

/** Modals / detail screens reachable from any tab. */
export type RootStackParamList = {
  MainTabs: undefined;
  AISettings: undefined;
  SmartEntry: { mode?: SmartEntryMode } | undefined;
  Tasks: undefined;
  MealLog: undefined;
  SleepMoodCheckin: undefined;
  Preferences: undefined;
  Memory: undefined;
};
