import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts as useFraunces,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import {
  useFonts as useJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from './src/theme';
import { queryClient } from './src/services/query-client';
import { configureNotifications } from './src/services/notifications';
import { bootOfflineServices } from './src/services/offline';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { initI18n } from './src/i18n';
import { ErrorBoundary } from './src/components/ui';

/**
 * Round 22 — "Editorial Calm" type system.
 *
 * Two custom font families load before the app boots so headings,
 * status chips, and number-heavy stat cards all use Fraunces (variable
 * serif with oldstyle figures + soft italic), while body copy stays
 * crisp via Plus Jakarta Sans. The loader gates the splash screen so
 * the user never sees a font-flash on first paint.
 */
export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [serifLoaded] = useFraunces({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium_Italic,
  });
  const [sansLoaded] = useJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    (async () => {
      // i18n must be initialised before any screen mounts — otherwise
      // t() calls during the first render return raw keys.
      await initI18n();
      await bootOfflineServices(queryClient);
      configureNotifications();
      setBootReady(true);
    })();
  }, []);

  const ready = bootReady && serifLoaded && sansLoaded;

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
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
