import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Loading, ErrorView, Badge } from '../../components/ui';
import { useAuthStore } from '../../store/auth.store';
import { profileApi } from '../../services/api/profile.api';
import { QUERY_KEYS } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const profileQ = useQuery({ queryKey: QUERY_KEYS.profile, queryFn: profileApi.get });

  const onLogout = () =>
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <Screen scroll>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: spacing.md }}>
          Profile
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
            {user?.displayName ?? '—'}
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
          <ErrorView message={(profileQ.error as Error).message} onRetry={() => profileQ.refetch()} />
        ) : profileQ.data?.exists && profileQ.data.profile ? (
          <Card>
            <Row label="Goal" value={profileQ.data.profile.mainGoal ?? '—'} />
            <Row label="Activity" value={profileQ.data.profile.activityLevel ?? '—'} />
            <Row label="Wake / Sleep" value={`${profileQ.data.profile.usualWakeTime ?? '—'} → ${profileQ.data.profile.usualSleepTime ?? '—'}`} />
            <Row label="Work" value={`${profileQ.data.profile.workStartTime ?? '—'} → ${profileQ.data.profile.workEndTime ?? '—'}`} />
            <Row label="Timezone" value={profileQ.data.profile.timezone} />
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
              You haven't completed onboarding yet.
            </Text>
            <Button title="Run onboarding" onPress={() => navigation.navigate('Onboarding')} />
          </Card>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title="Settings" variant="secondary" onPress={() => navigation.navigate('Settings')} />
          <Button title="Weekly report" variant="secondary" onPress={() => navigation.navigate('WeeklyReport')} />
          <Button title="Log out" variant="danger" onPress={onLogout} />
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
