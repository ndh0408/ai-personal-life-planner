import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../theme';
import { SplashScreen } from '../screens/SplashScreen';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { MainTabsNavigator } from './MainTabsNavigator';

// Secondary / modal screens
import { CreateTaskScreen } from '../screens/tasks/CreateTaskScreen';
import { CreateHabitScreen } from '../screens/habits/CreateHabitScreen';
import { ScheduleDetailScreen } from '../screens/today/ScheduleDetailScreen';
import { SleepMoodCheckinScreen } from '../screens/today/SleepMoodCheckinScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { WeeklyReportScreen } from '../screens/reports/WeeklyReportScreen';
import { DailyReviewScreen } from '../screens/reports/DailyReviewScreen';
import { MonthlyFinanceReportScreen } from '../screens/reports/MonthlyFinanceReportScreen';
import { GoalProgressReportScreen } from '../screens/reports/GoalProgressReportScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { HabitsScreen } from '../screens/habits/HabitsScreen';
import { MealsScreen } from '../screens/meals/MealsScreen';
import { HealthScreen } from '../screens/health/HealthScreen';
import { HealthMetricScreen } from '../screens/health/HealthMetricScreen';
import { WalletsScreen } from '../screens/finance/WalletsScreen';
import { AddWalletScreen } from '../screens/finance/AddWalletScreen';
import { IncomeScreen } from '../screens/finance/IncomeScreen';
import { AddIncomeScreen } from '../screens/finance/AddIncomeScreen';
import { ExpenseScreen } from '../screens/finance/ExpenseScreen';
import { AddExpenseScreen } from '../screens/finance/AddExpenseScreen';
import { BudgetScreen } from '../screens/finance/BudgetScreen';
import { AddBudgetScreen } from '../screens/finance/AddBudgetScreen';
import { DebtScreen } from '../screens/finance/DebtScreen';
import { AddDebtScreen } from '../screens/finance/AddDebtScreen';
import { SavingGoalsScreen } from '../screens/finance/SavingGoalsScreen';
import { AddSavingGoalScreen } from '../screens/finance/AddSavingGoalScreen';
import { PersonalGoalsScreen } from '../screens/goals/PersonalGoalsScreen';
import { CreateGoalScreen } from '../screens/goals/CreateGoalScreen';
import { GoalDetailScreen } from '../screens/goals/GoalDetailScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { LanguageSettingsScreen } from '../screens/settings/LanguageSettingsScreen';
import { AiProviderSettingsScreen } from '../screens/settings/AiProviderSettingsScreen';
import { AddAiProviderScreen } from '../screens/settings/AddAiProviderScreen';
import { EditAiProviderScreen } from '../screens/settings/EditAiProviderScreen';
import { PrivacySettingsScreen } from '../screens/privacy/PrivacySettingsScreen';
import { PermissionCenterScreen } from '../screens/privacy/PermissionCenterScreen';
import { DataUsageSummaryScreen } from '../screens/privacy/DataUsageSummaryScreen';
import { PersonalizationConsentScreen } from '../screens/privacy/PersonalizationConsentScreen';
import { ClearAIMemoryScreen } from '../screens/privacy/ClearAIMemoryScreen';
import { RecommendationEvidenceScreen } from '../screens/privacy/RecommendationEvidenceScreen';
import { AIChatScreen } from '../screens/ai/AIChatScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isDark, colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.bgElevated,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'loading' ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : status === 'unauthenticated' ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabsNavigator} />
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />

            {/* Push-style secondary screens */}
            <Stack.Group screenOptions={{ headerShown: true }}>
              <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
              <Stack.Screen name="Habits" component={HabitsScreen} options={{ title: 'Habits' }} />
              <Stack.Screen name="Meals" component={MealsScreen} options={{ title: 'Meals' }} />
              <Stack.Screen name="Health" component={HealthScreen} options={{ title: 'Health' }} />
              <Stack.Screen name="HealthMetric" component={HealthMetricScreen} options={{ title: 'Log metrics' }} />
              <Stack.Screen name="Wallets" component={WalletsScreen} options={{ title: 'Wallets' }} />
              <Stack.Screen name="Income" component={IncomeScreen} options={{ title: 'Income' }} />
              <Stack.Screen name="Expense" component={ExpenseScreen} options={{ title: 'Expenses' }} />
              <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budget' }} />
              <Stack.Screen name="Debt" component={DebtScreen} options={{ title: 'Debt' }} />
              <Stack.Screen name="SavingGoals" component={SavingGoalsScreen} options={{ title: 'Saving Goals' }} />
              <Stack.Screen name="AddWallet" component={AddWalletScreen} options={{ title: 'New wallet', presentation: 'modal' }} />
              <Stack.Screen name="AddIncome" component={AddIncomeScreen} options={{ title: 'New income', presentation: 'modal' }} />
              <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'New expense', presentation: 'modal' }} />
              <Stack.Screen name="AddBudget" component={AddBudgetScreen} options={{ title: 'New budget', presentation: 'modal' }} />
              <Stack.Screen name="AddDebt" component={AddDebtScreen} options={{ title: 'New debt', presentation: 'modal' }} />
              <Stack.Screen name="AddSavingGoal" component={AddSavingGoalScreen} options={{ title: 'New saving goal', presentation: 'modal' }} />
              <Stack.Screen name="PersonalGoals" component={PersonalGoalsScreen} options={{ title: 'Goals' }} />
              <Stack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: 'Goal' }} />
              <Stack.Screen name="CreateGoal" component={CreateGoalScreen} options={{ title: 'New goal', presentation: 'modal' }} />
              <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
              <Stack.Screen name="DailyReview" component={DailyReviewScreen} options={{ title: 'Daily review' }} />
              <Stack.Screen name="MonthlyFinanceReport" component={MonthlyFinanceReportScreen} options={{ title: 'Monthly report' }} />
              <Stack.Screen name="GoalProgressReport" component={GoalProgressReportScreen} options={{ title: 'Goal progress' }} />
            </Stack.Group>

            {/* Modal-style */}
            <Stack.Group screenOptions={{ presentation: 'modal', headerShown: true }}>
              <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'New task' }} />
              <Stack.Screen name="CreateHabit" component={CreateHabitScreen} options={{ title: 'New habit' }} />
              <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} options={{ title: 'Schedule' }} />
              <Stack.Screen name="SleepMoodCheckin" component={SleepMoodCheckinScreen} options={{ title: 'Check-in' }} />
              <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: 'Weekly report' }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
              <Stack.Screen
                name="LanguageSettings"
                component={LanguageSettingsScreen}
                options={{ title: 'Language' }}
              />
              <Stack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'AI assistant' }} />
              <Stack.Screen
                name="AiProviderSettings"
                component={AiProviderSettingsScreen}
                options={{ title: 'AI provider' }}
              />
              <Stack.Screen
                name="AddAiProvider"
                component={AddAiProviderScreen}
                options={{ title: 'Add provider' }}
              />
              <Stack.Screen
                name="EditAiProvider"
                component={EditAiProviderScreen}
                options={{ title: 'Edit provider' }}
              />
              <Stack.Screen
                name="PrivacySettings"
                component={PrivacySettingsScreen}
                options={{ title: 'Privacy' }}
              />
              <Stack.Screen
                name="PermissionCenter"
                component={PermissionCenterScreen}
                options={{ title: 'Permissions' }}
              />
              <Stack.Screen
                name="DataUsageSummary"
                component={DataUsageSummaryScreen}
                options={{ title: 'Data usage' }}
              />
              <Stack.Screen
                name="PersonalizationConsent"
                component={PersonalizationConsentScreen}
                options={{ title: 'Personalisation' }}
              />
              <Stack.Screen
                name="ClearAIMemory"
                component={ClearAIMemoryScreen}
                options={{ title: 'Clear AI memory' }}
              />
              <Stack.Screen
                name="RecommendationEvidence"
                component={RecommendationEvidenceScreen}
                options={{ title: 'Why am I seeing this?' }}
              />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}
