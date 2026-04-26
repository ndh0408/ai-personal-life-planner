/**
 * LifeOS AI — top-level shell.
 *
 * Round 1 surface: state-machine "router" driven by the auth store. No
 * react-navigation yet — the four screens we ship don't justify it. When
 * the home tab grows real navigation in round 3, swap in @react-navigation/native.
 */
import React, { useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { AuthProvider, useAuth } from './src/state/auth';
import { palette } from './src/design/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { AISetupScreen } from './src/screens/AISetupScreen';
import { AISettingsScreen } from './src/screens/AISettingsScreen';
import { HomeScreen } from './src/screens/HomeScreen';

type AuthRoute = 'login' | 'register';
type HomeRoute = 'home' | 'aiSettings';

function Router() {
  const { state } = useAuth();
  const [authRoute, setAuthRoute] = useState<AuthRoute>('login');
  const [homeRoute, setHomeRoute] = useState<HomeRoute>('home');

  if (state.stage === 'booting') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (state.stage === 'unauthenticated') {
    return authRoute === 'login' ? (
      <LoginScreen onGoToRegister={() => setAuthRoute('register')} />
    ) : (
      <RegisterScreen onGoToLogin={() => setAuthRoute('login')} />
    );
  }

  if (state.stage === 'needs_ai_key') {
    return <AISetupScreen />;
  }

  // ready
  return homeRoute === 'home' ? (
    <HomeScreen onOpenAISettings={() => setHomeRoute('aiSettings')} />
  ) : (
    <AISettingsScreen onBack={() => setHomeRoute('home')} />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={palette.canvas} />
      <I18nProvider>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
