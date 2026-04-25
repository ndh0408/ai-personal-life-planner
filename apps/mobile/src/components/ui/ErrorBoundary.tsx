import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Button } from './Button';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Top-level error boundary. Without this, any uncaught render error in any
 * screen crashes the bundle (white screen of death) and the user has to kill
 * the app. Catching it here lets us surface a localised "Something went
 * wrong" plus a "Try again" button that re-mounts the tree.
 *
 * Class component because hooks can't catch render errors today.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Intentionally minimal — when Sentry/Crashlytics lands, this is the
    // hook to forward the error. Do NOT log raw user data.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] uncaught render error', error.name, error.message);
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return <FallbackUI onReset={this.reset} />;
  }
}

function FallbackUI({ onReset }: { onReset: () => void }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.danger, fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>
        {t('errors.UNKNOWN_ERROR')}
      </Text>
      <Button title={t('common.tryAgain')} onPress={onReset} />
    </View>
  );
}
