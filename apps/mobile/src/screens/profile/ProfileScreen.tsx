import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge } from '../../components/ui';
import { useAuthStore } from '../../store/auth.store';
import { profileApi } from '../../services/api/profile.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const profileQ = useQuery({ queryKey: QUERY_KEYS.profile, queryFn: profileApi.get });

  const dash = t('common.dash');
  const onLogout = () =>
    Alert.alert(t('profile.logoutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <Screen scroll>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: spacing.md }}>
          {t('profile.title')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
            {user?.displayName ?? dash}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>{user?.email ?? ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
            <Badge tone="primary">{user?.role ?? 'USER'}</Badge>
            <Badge tone={user?.status === 'ACTIVE' ? 'success' : 'danger'}>
              {user?.status ?? 'ACTIVE'}
            </Badge>
          </View>
        </Card>

        {profileQ.isLoading ? (
          <Loading />
        ) : profileQ.isError ? (
          <ErrorView message={messageFor(profileQ.error)} onRetry={() => profileQ.refetch()} />
        ) : profileQ.data?.exists && profileQ.data.profile ? (
          <Card>
            <Row label={t('profile.row.goal')} value={profileQ.data.profile.mainGoal ?? dash} />
            <Row label={t('profile.row.activity')} value={profileQ.data.profile.activityLevel ?? dash} />
            <Row
              label={t('profile.row.wakeSleep')}
              value={`${profileQ.data.profile.usualWakeTime ?? dash} → ${profileQ.data.profile.usualSleepTime ?? dash}`}
            />
            <Row
              label={t('profile.row.work')}
              value={`${profileQ.data.profile.workStartTime ?? dash} → ${profileQ.data.profile.workEndTime ?? dash}`}
            />
            <Row label={t('profile.row.timezone')} value={profileQ.data.profile.timezone} />
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
              {t('profile.noOnboarding')}
            </Text>
            <Button title={t('profile.runOnboarding')} onPress={() => navigation.navigate('Onboarding')} />
          </Card>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title={t('profile.settings')} variant="secondary" onPress={() => navigation.navigate('Settings')} />
          <Button title={t('profile.weeklyReport')} variant="secondary" onPress={() => navigation.navigate('WeeklyReport')} />
          <Button title={t('auth.logout')} variant="danger" onPress={onLogout} />
        </View>
      </ScrollView>
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
      <Text style={{ color: colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
