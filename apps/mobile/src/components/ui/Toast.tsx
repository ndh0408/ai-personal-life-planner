import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

type Tone = 'success' | 'warning' | 'danger' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  tone?: Tone;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastApi {
  show: (message: string, tone?: Tone, durationMs?: number) => void;
  /** Round 22: show with an inline action button (e.g. Undo). */
  showWithAction: (message: string, options: ToastOptions) => void;
}

const Ctx = createContext<ToastApi | null>(null);

interface ToastState {
  message: string;
  tone: Tone;
  action: ToastAction | null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-40)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -40, duration: 160, useNativeDriver: true }),
    ]).start(() => setState(null));
  }, [opacity, translateY]);

  const showInternal = useCallback(
    (message: string, tone: Tone, durationMs: number, action: ToastAction | null) => {
      setState({ message, tone, action });
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

  const show = useCallback(
    (message: string, tone: Tone = 'info', durationMs = 3000) => {
      showInternal(message, tone, durationMs, null);
    },
    [showInternal],
  );

  const showWithAction = useCallback(
    (message: string, options: ToastOptions) => {
      // Action toasts get more time on screen — Material Design suggests
      // ~6-8 s when there's a button to tap.
      showInternal(
        message,
        options.tone ?? 'success',
        options.durationMs ?? 6000,
        options.action ?? null,
      );
    },
    [showInternal],
  );

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  return (
    <Ctx.Provider value={{ show, showWithAction }}>
      {children}
      {state ? (
        <Animated.View
          // pointerEvents=auto so a button inside is tappable; without an
          // action the press-through behaviour of the old toast was harmless.
          pointerEvents={state.action ? 'box-none' : 'none'}
          style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.toast, TONE[state.tone].container]}>
            <Text style={[styles.message, TONE[state.tone].text]}>{state.message}</Text>
            {state.action ? (
              <Pressable
                onPress={() => {
                  const action = state.action;
                  if (!action) return;
                  action.onPress();
                  dismiss();
                }}
                style={styles.actionWrap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={state.action.label}
              >
                <Text style={[styles.actionLabel, TONE[state.tone].text]}>
                  {state.action.label}
                </Text>
              </Pressable>
            ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  message: { ...typography.bodyEm, textAlign: 'center', flexShrink: 1 },
  actionWrap: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: 'auto',
  },
  actionLabel: {
    ...typography.bodyEm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
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
