import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './src/theme';
import { queryClient } from './src/services/query-client';
import { configureNotifications } from './src/services/notifications';
import { bootOfflineServices } from './src/services/offline';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { initI18n } from './src/i18n';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // i18n must be initialised before any screen mounts — otherwise
      // t() calls during the first render return raw keys.
      await initI18n();
      await bootOfflineServices(queryClient);
      configureNotifications();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <RootNavigator />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
