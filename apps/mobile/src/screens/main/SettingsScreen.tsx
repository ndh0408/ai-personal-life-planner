import React from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  Card,
  QuickActionButton,
  Text,
} from '../../components/ui';
import { spacing } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { i18n } from '../../i18n';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const currentLocale = i18n.language;

  const handleLogout = () => {
    Alert.alert(t('auth.logoutCta'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logoutCta'), style: 'destructive', onPress: signOut },
    ]);
  };

  const switchLanguage = (next: 'vi' | 'en') => {
    void i18n.changeLanguage(next);
  };

  return (
    <AppScreen>
      <Text variant="kicker">{t('tabs.settings')}</Text>
      <Text variant="display" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        {t('settings.title')}
      </Text>

      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('settings.account')}
      </Text>
      <Card style={{ marginBottom: spacing.xl }}>
        <Text variant="bodyEm">{user?.displayName ?? user?.email}</Text>
        <Text variant="caption">{user?.email}</Text>
      </Card>

      <Text variant="kicker" style={{ marginBottom: spacing.sm }}>
        {t('settings.preferences')}
      </Text>
      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <QuickActionButton
          label={t('settings.aiKey')}
          glyph="◎"
          onPress={() => navigation.navigate('AISettings')}
        />
        <Card>
          <Text variant="caption" style={{ marginBottom: spacing.sm }}>
            {t('settings.language')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={t('settings.languageVi')}
              variant={currentLocale === 'vi' ? 'primary' : 'secondary'}
              onPress={() => switchLanguage('vi')}
              fullWidth={false}
            />
            <Button
              label={t('settings.languageEn')}
              variant={currentLocale === 'en' ? 'primary' : 'secondary'}
              onPress={() => switchLanguage('en')}
              fullWidth={false}
            />
          </View>
        </Card>
      </View>

      <Button label={t('auth.logoutCta')} variant="ghost" onPress={handleLogout} />
    </AppScreen>
  );
}
