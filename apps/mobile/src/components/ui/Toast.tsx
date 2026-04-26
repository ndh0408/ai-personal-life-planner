import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Tone = 'success' | 'warning' | 'danger' | 'info';

interface ToastApi {
  show: (message: string, tone?: Tone, durationMs?: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ message: string; tone: Tone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-40)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -40, duration: 160, useNativeDriver: true }),
    ]).start(() => setState(null));
  }, [opacity, translateY]);

  const show = useCallback<ToastApi['show']>(
    (message, tone = 'info', durationMs = 3000) => {
      setState({ message, tone });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(dismiss, durationMs);
    },
    [opacity, translateY, dismiss],
  );

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {state ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.toast, TONE[state.tone].container]}>
            <Text style={[styles.message, TONE[state.tone].text]}>{state.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
  },
  toast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: '60%',
    maxWidth: '95%',
  },
  message: { ...typography.bodyEm, textAlign: 'center' },
});

const TONE = {
  success: {
    container: { backgroundColor: 'rgba(127, 166, 107, 0.16)', borderColor: colors.status.success },
    text: { color: colors.status.success },
  },
  warning: {
    container: { backgroundColor: 'rgba(214, 162, 78, 0.16)', borderColor: colors.status.warning },
    text: { color: colors.status.warning },
  },
  danger: {
    container: { backgroundColor: 'rgba(201, 98, 74, 0.16)', borderColor: colors.status.danger },
    text: { color: colors.status.danger },
  },
  info: {
    container: { backgroundColor: 'rgba(107, 143, 168, 0.16)', borderColor: colors.status.info },
    text: { color: colors.status.info },
  },
} as const;
