import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Avatar,
  Button,
  Card,
  ConfirmModal,
  QuickActionButton,
  Text,
  useToast,
} from '../../components/ui';
import { spacing, colors } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { i18n } from '../../i18n';
import { APP_VERSION, APP_BUILD } from '../../config/build';
import { API_BASE_URL } from '../../services/api/config';
import { apiClient } from '../../services/api/client';
import { useWipeCache } from '../../hooks/useWipeCache';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

const TAPS_TO_OPEN_DEV = 7;

export function SettingsScreen({ navigation }: Props) {
  const { t, i18n: { language } } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const wipe = useWipeCache();
  const toast = useToast();

  const [tapCount, setTapCount] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleVersionTap = () => {
    const next = tapCount + 1;
    if (next >= TAPS_TO_OPEN_DEV) {
      setTapCount(0);
      setDevOpen(true);
    } else {
      setTapCount(next);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logoutCta'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logoutCta'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleWipe = async () => {
    setConfirmWipe(false);
    await wipe();
    toast.show(t('settings.wipeCacheDone'), 'success');
  };

  const switchLanguage = (next: 'vi' | 'en') => {
    void i18n.changeLanguage(next);
  };

  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.settings')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('settings.title')}
      </Text>

      {/* Account */}
      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('settings.account')}
      </Text>
      <Card style={{ marginBottom: spacing.xl }} emphasis="elevated">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={user?.displayName ?? user?.email ?? null} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" numberOfLines={1}>
              {user?.displayName ?? user?.email}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {user?.email}
            </Text>
            {user ? (
              <Text variant="caption" style={{ opacity: 0.7 }}>
                {t('settings.memberSince', { date: memberSince })}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      {/* Preferences */}
      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('settings.preferences')}
      </Text>
      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <QuickActionButton
          label={t('settings.aiKey')}
          glyph="◎"
          onPress={() => navigation.navigate('AISettings')}
        />
        <QuickActionButton
          label={t('settings.preferencesEntry')}
          glyph="◑"
          onPress={() => navigation.navigate('Preferences')}
        />
        <QuickActionButton
          label={t('settings.memoryEntry')}
          glyph="◔"
          onPress={() => navigation.navigate('Memory')}
        />
        <Card>
          <Text variant="caption" style={{ marginBottom: spacing.sm }}>
            {t('settings.language')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={t('settings.languageVi')}
              variant={language === 'vi' ? 'primary' : 'secondary'}
              onPress={() => switchLanguage('vi')}
              fullWidth={false}
            />
            <Button
              label={t('settings.languageEn')}
              variant={language === 'en' ? 'primary' : 'secondary'}
              onPress={() => switchLanguage('en')}
              fullWidth={false}
            />
          </View>
        </Card>
      </View>

      {/* Data */}
      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('settings.data')}
      </Text>
      <Card style={{ marginBottom: spacing.xl }}>
        <Text variant="caption" style={{ marginBottom: spacing.sm }}>
          {t('settings.wipeCacheBody')}
        </Text>
        <Button
          label={t('settings.wipeCache')}
          variant="secondary"
          onPress={() => setConfirmWipe(true)}
        />
      </Card>

      <Button label={t('auth.logoutCta')} variant="ghost" onPress={handleLogout} />

      {/* Version row — 7 taps to open Developer */}
      <Pressable onPress={handleVersionTap} hitSlop={8} style={styles.versionRow}>
        <Text variant="caption" style={{ color: colors.text.muted, textAlign: 'center' }}>
          {t('settings.version', { version: `${APP_VERSION} · ${APP_BUILD}` })}
          {tapCount > 0 && tapCount < TAPS_TO_OPEN_DEV ? ` (${TAPS_TO_OPEN_DEV - tapCount})` : ''}
        </Text>
      </Pressable>

      {/* Modals */}
      <ConfirmModal
        visible={confirmWipe}
        title={t('settings.wipeCache')}
        body={t('settings.wipeCacheBody')}
        confirmLabel={t('settings.wipeCacheConfirm')}
        cancelLabel={t('settings.wipeCacheCancel')}
        destructive
        onConfirm={handleWipe}
        onCancel={() => setConfirmWipe(false)}
      />

      {devOpen ? (
        <DevPanel onClose={() => setDevOpen(false)} userId={user?.id ?? '—'} />
      ) : null}
    </AppScreen>
  );
}

function DevPanel({ onClose, userId }: { onClose: () => void; userId: string }) {
  const { t } = useTranslation();
  const tokens = apiClient.getTokens();
  const rows: Array<[string, string]> = [
    [t('settings.developer.appVersion'), `${APP_VERSION} (${APP_BUILD})`],
    [t('settings.developer.platform'), `${Platform.OS} ${Platform.Version}`],
    [t('settings.developer.apiBaseUrl'), API_BASE_URL],
    [t('settings.developer.userId'), userId],
    [
      t('settings.developer.tokens'),
      tokens
        ? `${t('settings.developer.tokensPresent')} · exp ${new Date(
            tokens.accessTokenExpiresAt,
          ).toLocaleTimeString('vi-VN')}`
        : t('settings.developer.tokensMissing'),
    ],
  ];

  return (
    <View style={styles.devOverlay} pointerEvents="box-none">
      <Card emphasis="elevated" style={styles.devCard}>
        <Text variant="title">{t('settings.developer.title')}</Text>
        <View style={{ height: spacing.md }} />
        {rows.map(([k, v]) => (
          <View key={k} style={styles.devRow}>
            <Text variant="caption" style={{ width: 110 }}>
              {k}
            </Text>
            <Text variant="caption" style={{ flex: 1, color: colors.text.primary }}>
              {v}
            </Text>
          </View>
        ))}
        <View style={{ marginTop: spacing.md }}>
          <Button label={t('settings.developer.close')} variant="secondary" onPress={onClose} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  versionRow: { paddingVertical: spacing.lg, marginTop: spacing.md },
  devOverlay: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing['3xl'],
  },
  devCard: { gap: 6 },
  devRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
});
