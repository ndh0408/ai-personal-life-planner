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

/** Modals / detail screens reachable from any tab. */
export type RootStackParamList = {
  MainTabs: undefined;
  AISettings: undefined;
};
