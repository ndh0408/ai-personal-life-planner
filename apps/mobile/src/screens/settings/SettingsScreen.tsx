import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Screen, Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/auth.store';
import { env } from '../../config/env';
import { requestPushPermission } from '../../services/notifications';
import { getActiveLocale } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

export function SettingsScreen() {
  const { colors, spacing, isDark } = useTheme();
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const localeLabel =
    getActiveLocale() === 'vi' ? t('settings.language.vi') : t('settings.language.en');

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
        {t('profile.settings')}
      </Text>

      <Card style={{ marginBottom: spacing.md }}>
        <Row label={t('profile.language')} value={localeLabel} />
        <Row label="Theme" value={isDark ? 'Dark (system)' : 'Light (system)'} />
        <Row label="API" value={env.apiBaseUrl} />
        <Row label="Build" value={env.appEnv} />
        <Button
          title={t('settings.language.title')}
          variant="secondary"
          onPress={() => nav.navigate('LanguageSettings')}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('profile.notifications')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          Reminders for wake-up, meals, tasks and habits. We ask the OS for
          permission only after you opt in.
        </Text>
        <Button
          title="Enable push notifications"
          variant="secondary"
          onPress={async () => {
            const ok = await requestPushPermission();
            Alert.alert(ok ? 'Enabled' : 'Denied');
          }}
        />
      </Card>

      <Button title={t('auth.logout')} variant="danger" onPress={logout} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
