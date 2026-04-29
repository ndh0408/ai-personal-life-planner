import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '../i18n';
import { queryClient } from '../services/api/queryClient';
import { ToastProvider } from '../components/ui/Toast';
import { useAuthStore } from '../store/auth.store';
import { RootNavigator } from '../navigation/RootNavigator';
import { syncOrchestrator } from '../services/device/sync-orchestrator';

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const stage = useAuthStore((s) => s.stage);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Round 36: kick the sensor sync after auth is confirmed and on every
  // app foreground transition. The orchestrator debounces internally so
  // a fast background→foreground bounce is a no-op. Stage='ready' is
  // the post-onboarding main-app state.
  useEffect(() => {
    if (stage !== 'ready') return;
    void syncOrchestrator.run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncOrchestrator.run();
    });
    return () => sub.remove();
  }, [stage]);

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
