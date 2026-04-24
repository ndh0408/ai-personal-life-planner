import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Screen, Input, Button } from '../../components/ui';
import { profileApi } from '../../services/api/profile.api';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { OnboardingScreenProps } from '../../navigation/types';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function OnboardingScheduleScreen(_props: OnboardingScreenProps<'Schedule'>) {
  const navigation = useNavigation();
  const { colors, spacing } = useTheme();
  const [wake, setWake] = useState('06:30');
  const [sleep, setSleep] = useState('23:00');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [saving, setSaving] = useState(false);

  const onFinish = async () => {
    if (![wake, sleep, workStart, workEnd].every((t) => HHMM.test(t))) {
      Alert.alert('Use HH:mm', 'Times must be in 24-hour HH:mm format.');
      return;
    }
    setSaving(true);
    try {
      await profileApi.update({
        usualWakeTime: wake,
        usualSleepTime: sleep,
        workStartTime: workStart,
        workEndTime: workEnd,
      } as never);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' as never }] }));
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>
          Your usual rhythm
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
          We'll center plans around these.
        </Text>
        <View style={{ gap: spacing.md }}>
          <Input label="Wake up (HH:mm)" value={wake} onChangeText={setWake} />
          <Input label="Sleep (HH:mm)" value={sleep} onChangeText={setSleep} />
          <Input label="Work start (HH:mm)" value={workStart} onChangeText={setWorkStart} />
          <Input label="Work end (HH:mm)" value={workEnd} onChangeText={setWorkEnd} />
        </View>
      </View>
      <Button title="Done" size="lg" fullWidth loading={saving} onPress={onFinish} />
    </Screen>
  );
}
