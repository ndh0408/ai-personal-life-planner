import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Input } from '../../components/ui';
import { communicationApi } from '../../services/api/communication.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { QUERY_KEYS } from '../../constants';

export function AddMessageReminderScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const messageFor = useErrorMessage();
  const nav = useNavigation();
  const qc = useQueryClient();

  const [contactName, setContactName] = useState('');
  const [platform, setPlatform] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [remindAt, setRemindAt] = useState(new Date(Date.now() + 3_600_000).toISOString());

  const mut = useMutation({
    mutationFn: () =>
      communicationApi.createMessageReminder({
        contactName: contactName.trim() || undefined,
        platform: platform.trim() || undefined,
        title: title.trim(),
        note: note.trim() || undefined,
        remindAt,
        source: 'MANUAL',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.messageReminders });
      nav.goBack();
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const submit = () => {
    if (!title.trim()) {
      Alert.alert(t('errors.VALIDATION_FAILED'));
      return;
    }
    mut.mutate();
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md }}>
          {t('settings.communication.addMessageReminder.title')}
        </Text>

        <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Input
            label={t('settings.communication.addMessageReminder.contactName')}
            value={contactName}
            onChangeText={setContactName}
            autoCapitalize="words"
          />
          <Input
            label={t('settings.communication.addMessageReminder.platform')}
            value={platform}
            onChangeText={setPlatform}
            autoCapitalize="none"
          />
          <Input
            label={t('settings.communication.addMessageReminder.reminderTitle')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('settings.communication.addMessageReminder.note')}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Input
            label={t('settings.communication.addMessageReminder.remindAt')}
            value={remindAt}
            onChangeText={setRemindAt}
            autoCapitalize="none"
          />
        </Card>

        <Button
          title={t('settings.communication.addMessageReminder.save')}
          loading={mut.isPending}
          onPress={submit}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}
