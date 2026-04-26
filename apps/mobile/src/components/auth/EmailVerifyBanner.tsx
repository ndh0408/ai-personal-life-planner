import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../services/api/auth.api';
import { ApiError } from '../../services/api/client';
import { useErrorMessage } from '../../i18n/useErrorMessage';

/**
 * Round-18: shown on Dashboard when the signed-in user has not yet
 * verified their email. Surfaces:
 *   - one-line explainer
 *   - "Resend" → POST /api/auth/resend-verification
 *   - "Dismiss" → hides for the current app session only (state isn't
 *     persisted, so a fresh launch will show it again — intentional)
 *
 * The backend's resend endpoint always returns 202 (no email enumeration),
 * so the success copy is generic. Rate-limit / send-failure errors get
 * their own i18n line via the shared `useErrorMessage` mapper.
 *
 * Renders nothing when `user.emailVerifiedAt` is set OR when the user
 * dismissed for this session.
 */
export function EmailVerifyBanner() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<'ok' | 'error' | null>(null);

  if (!user || user.emailVerifiedAt || dismissed) return null;

  const onResend = async () => {
    if (submitting) return;
    setSubmitting(true);
    setStatusText(null);
    setStatusKind(null);
    try {
      await authApi.resendVerification(user.email);
      setStatusKind('ok');
      setStatusText(t('auth.verifyEmail.resendSuccess'));
    } catch (e) {
      const msg = e instanceof ApiError ? messageFor(e) : t('errors.UNKNOWN_ERROR');
      setStatusKind('error');
      setStatusText(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.warning + '22', // 13% alpha tint
        borderColor: colors.warning,
        borderWidth: 1,
        borderRadius: 10,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
          {t('auth.verifyEmail.bannerTitle')}
        </Text>
        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={{ color: colors.textMuted, marginTop: 6 }}>
        {t('auth.verifyEmail.bannerBody')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <Pressable
          onPress={onResend}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? colors.border : colors.primary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 8,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {t('auth.verifyEmail.resend')}
            </Text>
          )}
        </Pressable>
        {statusText && (
          <Text
            style={{
              color: statusKind === 'error' ? colors.danger : colors.success,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {statusText}
          </Text>
        )}
      </View>
    </View>
  );
}
