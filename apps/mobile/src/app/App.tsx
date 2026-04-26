import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '../i18n';
import { queryClient } from '../services/api/queryClient';
import { ToastProvider } from '../components/ui/Toast';
import { useAuthStore } from '../store/auth.store';
import { RootNavigator } from '../navigation/RootNavigator';

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
