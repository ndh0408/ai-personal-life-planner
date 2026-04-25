import React from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
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

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      Alert.alert(t('settings.notifications.enabled'));
      return;
    }
    Alert.alert(t('settings.notifications.denied'), t('settings.notifications.deniedHelp'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.openSettings'),
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
        {t('profile.settings')}
      </Text>

      <Card style={{ marginBottom: spacing.md }}>
        <Row label={t('profile.language')} value={localeLabel} />
        <Row
          label={t('settings.theme')}
          value={isDark ? t('settings.themeDarkSystem') : t('settings.themeLightSystem')}
        />
        <Row label={t('settings.apiUrl')} value={env.apiBaseUrl} />
        <Row label={t('settings.build')} value={env.appEnv} />
        <Button
          title={t('settings.language.title')}
          variant="secondary"
          onPress={() => nav.navigate('LanguageSettings')}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.notifications.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.notifications.description')}
        </Text>
        <Button
          title={t('settings.notifications.enable')}
          variant="secondary"
          onPress={handleEnablePush}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.aiProviders.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.aiProviders.subtitle')}
        </Text>
        <Button
          title={t('settings.aiProviders.menu')}
          variant="secondary"
          onPress={() => nav.navigate('AiProviderSettings')}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.privacy.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.privacy.subtitle')}
        </Text>
        <Button
          title={t('settings.privacy.menu')}
          variant="secondary"
          onPress={() => nav.navigate('PrivacySettings')}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.communication.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.communication.subtitle')}
        </Text>
        <Button
          title={t('settings.communication.menu')}
          variant="secondary"
          onPress={() => nav.navigate('CommunicationSettings')}
        />
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: spacing.sm }}>
          {t('settings.voice.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t('settings.voice.subtitle')}
        </Text>
        <Button
          title={t('settings.voice.menu')}
          variant="secondary"
          onPress={() => nav.navigate('VoiceCompanion')}
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
